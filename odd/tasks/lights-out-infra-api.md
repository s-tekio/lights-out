# Feature: lights-out-infra-api

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-09-25
**Workflow:** ODD (Organic Driven Development)

## Goal

Deploy the ranking API to AWS with Terraform: DynamoDB, Lambda and API Gateway on `eu-west-1`, plus
the observability and FinOps baseline the assignment requires.

## Structure, taken from the user's course practices

The layout mirrors `practices/15` and `practices/16`: a flat `terraform/` directory split by concern
rather than one large file.

| File | Contents |
| --- | --- |
| `providers.tf` | `terraform` block with the S3 backend and `required_providers`, plus `provider "aws"` |
| `variables.tf` | inputs |
| `api_gateway.tf` | HTTP API and stage |
| `main.tf` | role lookup, Lambda artifact, function, integration, route, permission |
| `observability.tf` | log group with explicit retention, alarm, SNS topic and subscription |
| `budget.tf` | AWS Budget with a notification threshold |
| `outputs.tf` | endpoints and ARNs |

## Decisions taken

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Region | `eu-west-1` | User's choice. |
| State | Existing bucket `commit-academy-tf-lo`, versioning on, one key for the project | User created it. |
| Locking | `use_lockfile = true` | S3-native locking, which is what the practices already do. No DynamoDB lock table is needed, which is the legacy approach. |
| Path | `terraform/`, not `infra/` | Matches the practices. The README and `docs/architecture.md` said `infra/` and are reconciled. |
| AWS profile | Removed from the backend and the provider | Both practices hardcode `profile = "commitacademy-student"`. That is machine specific and breaks in CI, where no such profile exists. The standard credential chain is used instead. |
| Role ARN | `data "aws_iam_role"` lookup by name | Explicitly requested: it removes the account id from the repository, which the practice 15 README flagged as wrong. |
| IAM least privilege | **Not achievable** | The student account denies IAM management, so the environment's `studentLambdaExecutionRole` must be reused as-is. The assignment requires least privilege, so this is recorded as an environment-imposed limitation rather than presented as done. |
| Lambda runtime | `nodejs22.x` | Matches `.nvmrc` and `engines: >=22`. Moving to 24 is two lines plus a test run, so nothing is locked in. |
| Custom domain | None | CloudFront's default domain already serves HTTPS with its own certificate, so no ACM certificate, no `us-east-1` provider alias and no Route 53 zone. Satisfies the HTTPS requirement at zero cost. |
| Tags | `default_tags` on the provider | `Project`, `Environment`, `Owner` as the assignment requires, plus `ManagedBy`. Applied centrally so a resource cannot be missed. |
| Alert destination | `alert_email` variable with no default | The assignment requires an active alarm. The address is not a secret but does not belong in the repository, so it comes from `terraform.tfvars`, which is already gitignored. |

## Slices

The user chose to split the work so each part is separately applicable and verifiable.

- [x] **1a — API deployed.** Terraform skeleton, role lookup, Lambda, API Gateway, log group with
  retention, alarm with SNS, AWS Budget, tags, and the static checks in CI. Verified with `curl`
  against the real URL. Exercises the whole chain without needing DynamoDB permissions.
- [ ] **1b — Persistence.** DynamoDB table and the repository adapter. Blocked on knowing what the
  environment role is allowed to do.
- [ ] **2 — Hosting.** S3 and CloudFront for the frontend.

## Evidence log

| Task | Commit | Evidence |
| --- | --- | --- |
| 1a | this commit | `terraform fmt -check -recursive` clean, `terraform init -backend=false` succeeded **without credentials**, `terraform validate` reports the configuration valid. Parent verified independently: no `profile` attribute anywhere (only the comment explaining its absence), no account id, ARN literal or email address under `terraform/`, `default_tags` on the provider rather than per resource, the role obtained through `data "aws_iam_role"`, a single catch-all `ANY /api/{proxy+}` route, explicit log group with retention plus `depends_on` from the Lambda, two symptom-named alarms and a monthly budget. 235 tests still pass and the whole repo builds. |
| 1a fixes | this commit | Two defects found in parent review. (1) `terraform/api.zip`, produced by `archive_file`, was **not gitignored**, so a build artefact could be committed; the user's own practices 15 and 16 have `lambda.zip` committed, so this was an inherited anti-pattern. Fixed by ignoring `terraform/*.zip`. (2) The README asserted the state bucket was "versioned, encrypted and public-access blocked" when only versioning had been confirmed; reworded as a checklist, since `encrypt = true` in the backend only covers the state object, not the bucket's default encryption. |
| 1a deployed | `696384a` | User applied: 12 resources created. First calls returned 404 on every route, and the response body was the application's own error shape, which proved the chain was healthy (Lambda deployed and ran, role worked, API Gateway routed, router answered) and isolated the fault to the stage prefix. Fixed by naming the stage `$default`; plan showed 1 to add, 1 to destroy, only the stage. |
| 1a verified | this commit | End-to-end against the live URL: `GET /api/health` 200 with `{"status":"ok","version":"0.1.0"}`, `POST /api/scores` 201 with `points: 900` for a 3x3 in 3 presses at 1.5 s (the exact base, as calculated by hand), invalid body 400 with per-field details, `GET /api/scores` 200 echoing `sort` and `order`, unknown route 404, `OPTIONS` 204. Both alarms confirmed wired to the SNS topic, and the user had already confirmed the subscription. |
| 1a verified fix | this commit | `api_health_url` was emitted with a double slash, because the `$default` stage's `invoke_url` already ends in one. Trimmed with `trimsuffix` and both URLs now build from a trimmed base. Plan after the change: no resource changes, only the two outputs. |

### Empirical demonstration that the in-memory store cannot back a leaderboard

Three sequential submissions from the same warm execution environment accumulated as expected (reads returned 4 scores: the three plus the earlier one). Twenty parallel submissions, by contrast, left every subsequent read reporting a single score.

So the submissions were accepted; what fails is that each Lambda execution environment holds its own isolated in-memory list. That is the concrete justification for slice 1b, not a theoretical one: the leaderboard is inconsistent by construction as long as the repository is in-memory.

### The alarms, verified with a real event

The first claim here was that the alarms could not be provoked and were only verified at the
configuration level. That turned out to be wrong: a real event happened during verification and the
alarm caught it.

| Metric at 12:48 | Value |
| --- | --- |
| API Gateway `5xx` | 3 |
| Lambda `Throttles` | 3 |
| Lambda `ConcurrentExecutions` (max) | 10 |
| Account concurrency limit | 10 |

The three `5xx` responses were **throttling, not a code failure**: the student account caps Lambda
concurrency at 10 and the verification script fired 20 parallel submissions. Ten ran, three were
rejected, API Gateway answered `5xx`, and `lights-out-dev-api-gateway-5xx` went OK to ALARM at
12:49:03, executed its SNS action and returned to OK at 13:04. `lights-out-dev-lambda-errors` stayed
OK throughout, which is exactly right: throttling is not a function error.

So the full alarm to SNS to email path is proven with an event that actually occurred, rather than
asserted from configuration.

### Correction to the earlier in-memory demonstration

The first write-up said that twenty parallel submissions produced a leaderboard of one, which read as
though all twenty had been accepted. Three were rejected with `5xx` by throttling. The accurate
statement is that **seventeen were accepted** and the reads still reported one score, because the
concurrent execution environments each hold their own in-memory list. The conclusion is unchanged and
in fact stronger, since it holds across as many as ten isolated environments.

### Environment-imposed capacity ceiling

The account's Lambda concurrency limit is 10. The assignment asks the API to survive a reasonable
traffic spike; with a ceiling of 10 the API throttles instead. In a normal account this is solved
with a quota increase or provisioned concurrency, and neither is available in a student lab. It is
recorded as an environment limitation, alongside least privilege and the CI/CD deployment block, and
it also shapes how these endpoints can be verified: bursts of parallel requests are not a usable test
method here.

## What was NOT verified

`terraform plan`, `apply`, `destroy` and every AWS data source read. The machine has no credentials, no `~/.aws` directory, no `aws` CLI and no named profile, so only the static checks ran. This is recorded rather than glossed: the configuration validates, but nothing has been proven against the real account, and the first `plan` is where an unexpected provider or API detail would surface.

`tflint` and `trivy` are also absent locally, so those run for the first time in CI.

## Open question blocking 1b

Reusing the environment role as-is means the Lambda has whatever permissions that role already grants
and nothing more, and it cannot be changed. If it lacks DynamoDB access, the deployed API can only use
the in-memory store, which resets on every cold start and cannot back a leaderboard.

The user was asked to check the role's attached policies in the IAM console. Slice 1a deliberately
avoids DynamoDB so that this does not block progress, and so the deployment chain is proven first.

## Credentials boundary

The parent never receives AWS credentials. Writing and validating Terraform needs none:
`terraform init -backend=false` installs providers without touching the state bucket, so `fmt` and
`validate` run unauthenticated. A `plan` needs credentials configured on the user's machine, and the
user drives every `apply`.

`tflint` and `tfsec`/`trivy` are not installed locally, so the static security analysis runs in CI
where they can be installed. That is a recorded deviation from the standards, not an oversight.
