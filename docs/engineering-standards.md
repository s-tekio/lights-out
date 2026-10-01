# Engineering standards

Normative document for this repository. It defines the bar that code and infrastructure must clear
before they are considered done.

## How to read this document

Every rule has an ID and an **enforcement** column:

| Enforcement | Meaning |
| --- | --- |
| `ci` | Automated. A pipeline fails when the rule is broken. |
| `hook` | Automated. A local pre-commit hook blocks the commit. |
| `tool` | Automated by the editor or the task runner, visible but not blocking. |
| `review` | Verified by a human or an agent during code review. Not automatable at acceptable cost. |

Rules are not aspirational. If a rule cannot be enforced or reviewed, it does not belong here.
**An exception requires a paragraph in this file stating the rule ID, the reason, and the expiry.**
Silent exceptions are treated as defects.

---

## 1. Source control

| ID | Rule | Enforcement |
| --- | --- | --- |
| SC-1 | Commit messages follow Conventional Commits (`type(scope): subject`). | review |
| SC-2 | One commit is one reviewable work unit: it does not mix unrelated refactors with behaviour changes, and it keeps tests and docs next to the behaviour they describe. | review |
| SC-3 | `main` only receives merges. Nothing is pushed to `main` directly. | review |
| SC-4 | Every change to `main` arrives through a branch that passed the full CI pipeline. | ci |

## 2. TypeScript

| ID | Rule | Enforcement |
| --- | --- | --- |
| TS-1 | `strict: true` and `noUncheckedIndexedAccess: true` in every package. Weakening either requires an exception. | ci |
| TS-2 | No `any`. Use `unknown` plus a real narrowing step. | ci |
| TS-3 | No non-null assertion (`!`) where a real check is possible. | review |
| TS-4 | Configuration is read once at startup, validated, and fails loudly when a required value is absent or malformed. Never read `process.env` deep inside business logic. | review |
| TS-5 | No unused variables, parameters or imports. | ci |

## 3. Architecture

| ID | Rule | Enforcement |
| --- | --- | --- |
| AR-1 | Dependencies point inward: `http` and `adapters` may import `application`, `ports` and `domain`. `domain` imports nothing outside itself. | review |
| AR-2 | Persistence and every external service sit behind a port. Swapping an adapter must not require touching `domain` or `application`. | review |
| AR-3 | Interfaces shared between applications are frozen in a document under `docs/` before either side is implemented. | review |
| AR-4 | Third-party dependencies require a justification. The API has **zero** runtime dependencies; adding one is a decision, not a convenience. | review |
| AR-5 | Cross-boundary payloads (HTTP, queue, storage) are validated at the boundary. Internal code never trusts a parsed payload shape it did not check. | ci |

## 4. Testing

| ID | Rule | Enforcement |
| --- | --- | --- |
| TE-1 | Every package has tests and a `test` script. | ci |
| TE-2 | Coverage must not fall below the configured threshold (statements/lines/functions/branches). | ci |
| TE-3 | Tests assert behaviour and contract, not implementation detail. A refactor that preserves behaviour must not break tests. | review |
| TE-4 | Boundary values are tested explicitly: minimum, maximum, one below minimum, one above maximum, wrong type, absent value. | review |
| TE-5 | The happy path is not sufficient. Error paths, ordering guarantees and ties are covered. | review |
| TE-6 | Discovery is tested end to end at least once per boundary: a real HTTP request against the real router, not only a mocked unit call. | review |

## 5. Security

| ID | Rule | Enforcement |
| --- | --- | --- |
| SEC-1 | No secret, token, account ID or credential is committed. Not in code, not in `.tfvars`, not in test fixtures. | ci |
| SEC-2 | Secrets live in AWS Secrets Manager or SSM Parameter Store and are referenced, never copied into the repository or into Terraform state. | review |
| SEC-3 | All internet-facing traffic is HTTPS. Plain HTTP is redirected or rejected, never served. | review |
| SEC-4 | Buckets and tables deny public access explicitly. | review |
| SEC-5 | Data is encrypted at rest and in transit. | review |
| SEC-6 | IAM policies grant explicit actions on explicit resource ARNs. A wildcard in `Action` or `Resource` requires an exception in this document. No `*FullAccess` managed policy is attached to an application role. | review |
| SEC-7 | User-supplied strings are validated against an allow-list before use, storage or display. | ci |
| SEC-8 | Error responses never leak internal detail: no stack traces, no driver messages, no file paths. Internal detail is logged, not returned. | ci |

## 6. Observability

| ID | Rule | Enforcement |
| --- | --- | --- |
| OB-1 | Logs are structured JSON with stable field names, so CloudWatch Logs Insights can query by field instead of by regular expression. | review |
| OB-2 | Expected client errors (4xx) are not logged at error level. Error-level noise makes alarms useless. | ci |
| OB-3 | Every CloudWatch log group has an explicit retention period. "Never expire" requires an exception. | review |
| OB-4 | At least one alarm notifies a real destination, and the alarm is actionable: it names a symptom, not a cause. | review |
| OB-5 | Request-scoped correlation identifiers are attached to logs so a request can be traced across components. | review |

## 7. Cost (FinOps)

| ID | Rule | Enforcement |
| --- | --- | --- |
| CO-1 | Every resource carries `Project`, `Environment` and `Owner` tags, applied through provider `default_tags` rather than per-resource repetition. | review |
| CO-2 | An AWS Budget with a notification threshold exists before the first deployment. | review |
| CO-3 | Components that bill per hour while idle are avoided. A NAT Gateway requires an exception. | review |
| CO-4 | The README states a monthly cost estimate with the assumptions behind it. | review |
| CO-5 | Destructive teardown instructions exist and are accurate. | review |

## 8. Terraform

| ID | Rule | Enforcement |
| --- | --- | --- |
| TF-1 | Remote state in a versioned, encrypted, public-access-blocked S3 bucket, with locking. The state bucket is created by a separate minimal bootstrap. | review |
| TF-2 | `terraform fmt` and `terraform validate` pass. | ci |
| TF-3 | `terraform fmt -check` and `terraform validate` pass in CI. These catch syntax, invalid arguments and deprecated usage. | ci |
| TF-4 | `required_version` and provider version constraints are pinned, and `.terraform.lock.hcl` is committed. | ci |
| TF-5 | No hardcoded account ID, region, AZ, domain or ARN prefix. These come from variables or data sources. | review |
| TF-6 | Every variable declares `type` and `description`; environment-specific values have no default; values with a constrained domain declare `validation`. | review |
| TF-7 | Infrastructure is composed from modules owned by this repository, one per concern (network, storage, api, database, observability). Copy-pasted resource blocks across environments are a defect. | review |
| TF-8 | Stateful resources declare `prevent_destroy` unless the resource is explicitly ephemeral. | review |
| TF-9 | Terraform state buckets are encrypted and versioned; no secret is ever written into a variable that lands in state. | review |
| TF-10 | `plan` runs on pull requests and `apply` runs only from `main` after review. Production is never applied from a workstation. | review |
| TF-11 | DynamoDB tables enable point-in-time recovery. This is what makes the backup automatic. | review |
| TF-12 | Dev and prod are separated by state and by variable values, not by editing resource names. | review |

## 9. Documentation

| ID | Rule | Enforcement |
| --- | --- | --- |
| DOC-1 | The README covers: what the product does, the architecture diagram, the architecture decision with rejected alternatives, reproducible deployment steps, the monthly cost estimate, and teardown steps. | review |
| DOC-2 | Every non-obvious decision that constrains future work is written down where the code lives, not only in chat. | review |
| DOC-3 | Documentation states what is **not** implemented. Known limitations are listed rather than omitted. | review |
| DOC-4 | Code, comments, commit messages, identifiers and repository documentation are written in English. | tool |

---

## Known limitations of this project

Recorded here so they are visible rather than discovered later.

| Limitation | Impact | Tracked in |
| --- | --- | --- |
| The ranking API cannot verify that a game was actually solved. A client can report a plausible `moves` / `elapsedMs` pair. | The leaderboard is not trustworthy against a determined cheater. Server-side points computation removes arbitrary score injection, not result fabrication. | `docs/api-contract.md`, README future work |
| The in-memory score repository does not survive a process restart. | Expected in local development. Production uses the DynamoDB adapter. | `lights-out-infra` feature |
| No authentication. Player names are self-declared and unverified. | Anyone can submit under any name. | Future work |

## Exceptions

Rules here are waived only when the reason and expiry are recorded. Silent exceptions are treated
as defects.

### TF-10 — Terraform plan on pull requests

The standard requires that `terraform plan` runs on pull requests and `terraform apply` runs only
from `main` after review. The apply half holds: the `deploy` job is gated to pushes to `main` and
needs both the `quality` and `terraform` jobs to pass first.

The plan half is deliberately not implemented. The deploy job uses temporary lab credentials stored
as repository secrets; they expire when the lab session ends. Running `terraform plan` on every pull
request would fail with an expired or missing session token for a reason entirely unrelated to the
pull request's content, which turns a stale credential into noise on unrelated changes. A failing
check that is not about the change is worse than an absent one.

**Expiry:** when the repository can authenticate GitHub Actions through OIDC or another non-session
credential source.

### TF-3 — Removal of `tflint` and Trivy

The rule originally required static analysis with `tflint` and a security scanner such as
`tfsec`/`trivy`. Both tools have been removed from the CI pipeline.

`terraform fmt -check` and `terraform validate` remain as the enforced baseline. They catch syntax,
invalid arguments and deprecated usage, which was most of what `tflint` was providing.

Trivy was configured to fail on CRITICAL and HIGH severity findings, but every HIGH finding it
reported was listed in `.trivyignore`. A gate whose every finding is excepted asserts nothing and
is worse than no gate because it looks like assurance. Rather than keeping a scanner whose output
is fully waived, the two genuine unfixed findings are recorded with their cost reasoning: no
CloudFront WAF, and SSE-S3 instead of a customer-managed key for the S3 bucket. The fixes that came out of the scanning exercise stay: SNS topic encryption and API
Gateway throttling are real improvements and are not reverted.

`tflint` had reported zero findings since it was wired up, while costing a plugin download and two
extra steps per run. The baseline checks cover what mattered in practice.

**Expiry:** if the project later adds enough Terraform surface, sensitive data, or budget that a
linter or security scanner becomes proportionate, re-introduce the tool with a genuine plan to act
on its findings rather than waiving all of them.
