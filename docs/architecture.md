# Architecture

Companion to the architecture decision in the [README](../README.md). That document explains *why*
serverless; this one explains *how* the pieces fit and what the AWS data model looks like.

## Components

| Component | Responsibility | Current state |
| --- | --- | --- |
| `apps/web` | Renders the puzzle, tracks moves and time, submits results, renders the leaderboard. | Implemented |
| `apps/api` domain | Scoring formula and input validation. Pure functions, no I/O. | Implemented |
| `apps/api` application | Use cases: submit a score, list the leaderboard. | Implemented |
| `apps/api` ports | `ScoreRepository`. The seam between business logic and storage. | Implemented |
| `apps/api` adapters | `InMemoryScoreRepository` for local development, `DynamoDbScoreRepository` for AWS. | Implemented |
| `apps/api` http | Framework-agnostic router plus a thin Lambda adapter and a local `node:http` server. | Implemented |
| `terraform/` | Infrastructure as code for the AWS stack. | Implemented: API, DynamoDB, observability, budget and CloudFront/S3 hosting |

## The router is the centre of the design

`apps/api/src/http/router.ts` takes a plain `{ method, path, query, body }` and returns a plain
`{ statusCode, headers, body }`. It knows nothing about API Gateway and nothing about `node:http`.

Two adapters wrap it:

- `http/lambda.ts` translates an `APIGatewayProxyEventV2` into that shape.
- `local-server.ts` translates a `node:http` request into that shape.

The consequence is that local development exercises the **real** request handling path — the same
validation, the same scoring, the same error mapping — instead of a reimplementation that can drift
from production. The only untested-in-production part is the event translation itself.

This is why the domain and application layers can be plain TypeScript with no AWS SDK import: only
the adapter knows about the platform.

## Request flows

### Submit a score

```
browser                CloudFront        API Gateway     Lambda              DynamoDB
  │ POST /api/scores        │                │             │                     │
  ├────────────────────────>│                │             │                     │
  │                         ├───────────────>│             │                     │
  │                         │                ├────────────>│                     │
  │                         │                │   validate payload (allow-list)   │
  │                         │                │   compute points server-side      │
  │                         │                │   generate id, stamp createdAt    │
  │                         │                │             ├────────────────────>│
  │                         │                │             │      PutItem        │
  │                         │                │             │<────────────────────┤
  │                         │                │   count items ranked ahead of it  │
  │                         │                │             ├────────────────────>│
  │                         │                │             │<────────────────────┤
  │<────────────────────────┴────────────────┴─────────────┤ 201 score + rank    │
```

### Read the leaderboard

```
browser                CloudFront        API Gateway     Lambda              DynamoDB
  │ GET /api/scores?limit=10 │              │             │                     │
  ├────────────────────────>│                │             │                     │
  │                         ├───────────────>│             │                     │
  │                         │                ├────────────>│                     │
  │                         │                │   validate limit and boardSize    │
  │                         │                │             ├────────────────────>│
  │                         │                │             │  Query, limit 10    │
  │                         │                │             │<────────────────────┤
  │<────────────────────────┴────────────────┴─────────────┤ 200 items           │
```

## Server authority over the leaderboard

**The leaderboard has no client-side state.** This is a deliberate constraint, not an accident of
the current implementation, and it must survive the move to DynamoDB.

- The client never stores, caches or optimistically fabricates scores. The only value it keeps
  locally is the player's name, so the submission form can prefill.
- Every load, filter change and refresh issues a real request. There is no in-memory list that a
  component can read instead of asking the server.
- The server is the only writer. `POST /api/scores` computes the points, and `GET /api/scores`
  reads them back.
- The in-memory repository is the **server's** store, not the browser's. Swapping it for the
  DynamoDB adapter changes where the server reads from and nothing on the wire.

Why it matters here specifically: the moment the client keeps a copy, two things break. A score
submitted on another device would never appear, and the leaderboard would quietly disagree with the
database. Any future caching must be an explicit, documented decision with an invalidation story,
not an optimisation nobody remembers making.

The consequence for the DynamoDB adapter is that every read path the UI can reach has to exist as a
real access pattern. A sortable column is not a display concern: it is a query, and it needs a key
or an index to be efficient. That is recorded in the data model below.

## DynamoDB data model

The table is implemented in `terraform/dynamodb.tf` and mirrored by the DynamoDB Local integration
test setup. The canonical ranking requires an exact ordering: `points` descending, then `elapsedMs`
ascending, then `createdAt` ascending, then `id` ascending. DynamoDB sorts sort keys ascending, so
the ordering is encoded into the key with inverted components.

| Concern | Design |
| --- | --- |
| Table | `${project}-${environment}-scores`, on-demand billing, point-in-time recovery enabled, deletion protection on |
| Primary key | `id` (UUID v4) only |
| Scope attributes | `allScope = "all"`, `boardScope = "board#<boardSize>"` |
| Attributes | `playerName`, `boardSize`, `moves`, `elapsedMs`, `points`, `createdAt`, `playerNameLower` |
| GSI `by-points-all` | PK `allScope`, SK `pointsKey` |
| GSI `by-time-all` | PK `allScope`, SK `timeKey` |
| GSI `by-player-all` | PK `allScope`, SK `playerKey` |
| GSI `by-points-board` | PK `boardScope`, SK `pointsKey` |
| GSI `by-time-board` | PK `boardScope`, SK `timeKey` |
| GSI `by-player-board` | PK `boardScope`, SK `playerKey` |

Each score is stored as **one item**. A single `PutItem` is atomic by construction, so the write
needs no transaction. The item carries both `allScope` and `boardScope`, and the six GSIs provide
every query path. There are two query shapes (all scores vs. one board size) times three sort
dimensions (`points`, `elapsedMs`, `playerName`). Direction is handled by `ScanIndexForward`, not
by extra indexes.

### Partition note

The three `all`-scoped indexes have a single partition key value: `"all"`. That is unavoidable,
because "the leaderboard across every board size" is one partition by definition and cannot be
sharded without breaking global ordering. The three `board`-scoped indexes are sharded by board
size. A single DynamoDB partition caps at roughly 3 000 read capacity units and 1 000 write
capacity units per second. That ceiling is irrelevant at this scale and a real constraint at much
larger ones.

### Sort-key encodings

`#` is a safe separator: player names are allow-listed to `[A-Za-z0-9 _\-.]`, `createdAt` is ISO
8601, and `id` is a UUID, so none of them can contain it.

| GSI | Sort key | Natural direction |
| --- | --- | --- |
| `by-points-*` | `pad6(999999 - points) + '#' + pad9(elapsedMs) + '#' + createdAt + '#' + id` | `points` descending |
| `by-time-*` | `pad9(elapsedMs) + '#' + createdAt + '#' + id` | `elapsedMs` ascending |
| `by-player-*` | `playerNameLower + '#' + playerName + '#' + createdAt + '#' + id` | `playerName` ascending |


## Failure modes

| Failure | Behaviour | Where handled |
| --- | --- | --- |
| Invalid payload | `400` with per-field messages. Nothing is written. | `domain/validation.ts` |
| Malformed JSON | `400`, treated as a validation failure rather than a server error. | `http/router.ts` |
| Unknown route | `404`. | `http/router.ts` |
| Known route, wrong method | `405`. | `http/router.ts` |
| Preflight request | `204` with CORS headers. | `http/router.ts` |
| Storage failure | `500` with a generic body; the real error is logged with method, path and message. | `http/router.ts` |
| Network failure in the browser | Distinct error type; the game result stays on screen for a retry. | `apps/web/src/api/scores.ts` |
| Malformed success response | Rejected by type guards rather than cast into a `Score`. | `apps/web/src/api/scores.ts` |
| `localStorage` unavailable | Reads and writes are swallowed; the game works without persistence. | `components/PlayerNameForm.tsx` |

Expected client errors are **not** logged at error level. This is deliberate: a leaderboard where
every mistyped name emits an error-level log makes any CloudWatch alarm on errors useless.

## Security posture

| Property | How it is achieved |
| --- | --- |
| No secrets in the application | There are none to hold. No database credentials, no API keys. IAM grants the Lambda access to DynamoDB, so nothing is stored in configuration. |
| Least privilege | Intended: one role per Lambda, scoped to the `scores` table and its indexes, explicit actions on explicit ARNs, no wildcards, no `*FullAccess` managed policy. **What the deployed stack does instead:** the lab account denies IAM management, so the function reuses the pre-existing execution role as it is, and its permissions may be broader than that. Closing the gap needs an account that allows creating roles. |
| Encryption in transit | CloudFront serves HTTPS only; plain HTTP is redirected. |
| Encryption at rest | DynamoDB encrypts at rest by default; S3 uses SSE. |
| Input validation | Player names pass an allow-list; numbers are bounded and integer-checked. This happens server-side, so a modified client changes nothing. |
| No internal leakage | Error responses carry a code and a message, never a stack trace or a driver error. |
| No public data exposure | The S3 bucket is private and served only through CloudFront with an origin access control. |

Known gaps, stated rather than implied: **no authentication**, **no rate limiting**, and **no
ability to verify that a submitted game was actually played**.

## Local and production parity

| Concern | Local | Production | Parity |
| --- | --- | --- | --- |
| Request path | `/api/...` | `/api/...` | Identical, no rewrite rules |
| Routing and validation | `http/router.ts` | `http/router.ts` | Same code |
| Compute | `node:http` process | Lambda | Different, but both delegate to the router |
| Storage | In-memory by default, or DynamoDB Local via `SCORES_TABLE_NAME` | DynamoDB | Equivalent when DynamoDB Local is used; ordering semantics are identical |
| TLS | None | CloudFront | Different |
| CORS | Permissive headers from the router | Not needed: `/api/*` is same-origin behind CloudFront | Simpler in production |

The storage row is the honest gap. The in-memory adapter reproduces the contract's ordering but not
DynamoDB's read consistency or its conditional-write behaviour, which is why the DynamoDB adapter
needs its own integration tests rather than reusing the in-memory ones.

## Static asset caching

CloudFront serves the React SPA from a private S3 bucket through an origin access control. Two
custom cache policies are used:

| Path pattern | Cache policy | TTL | Purpose |
| --- | --- | --- | --- |
| `/*` (default) | `index.html` | `min_ttl = 0`, `default_ttl = 0`, `max_ttl = 0` | Never cache `index.html`; it references hashed assets and must be fresh. |
| `/assets/*` | `assets` | `min_ttl = 0`, `default_ttl = 31536000`, `max_ttl = 31536000` | Cache immutable hashed assets for a year. |

Both policies include only the URL path in the cache key: no cookies, headers or query strings are
forwarded, and gzip compression is enabled. S3 objects are uploaded with matching `Cache-Control`
metadata: `no-cache` for `index.html` and `public, max-age=31536000, immutable` for everything under
`assets/`. Because a new build changes the hashed asset filenames in `index.html`, no explicit
invalidation is required.

## Known limitations and accepted trade-offs

Recorded here so they are visible rather than discovered later.

### Known limitations

| Limitation | Impact |
| --- | --- |
| The ranking API cannot verify that a game was actually solved. A client can report a plausible `moves` / `elapsedMs` pair. | The leaderboard is not trustworthy against a determined cheater. Server-side points computation removes arbitrary score injection, not result fabrication. |
| The in-memory score repository does not survive a process restart. | Expected in local development. Production uses the DynamoDB adapter. |
| No authentication. Player names are self-declared and unverified. | Anyone can submit under any name. |
| The account caps Lambda concurrency at 10. | A burst above that is throttled rather than scaled, and the API answers 5xx. Raising it needs a quota increase or provisioned concurrency, neither of which the lab account allows. |

### Accepted trade-offs

**Terraform plan is not run on pull requests.** The apply half of the deployment is gated to pushes to `main` and needs both the `quality` and `terraform` jobs to pass first. The plan half is deliberately not implemented. The deploy job uses temporary lab credentials stored as repository secrets; they expire when the lab session ends. Running `terraform plan` on every pull request would fail with an expired or missing session token for a reason entirely unrelated to the pull request's content, which turns a stale credential into noise on unrelated changes. A failing check that is not about the change is worse than an absent one.

**The enforced Terraform baseline is `terraform fmt --check` and `terraform validate`.** `tflint` and Trivy were removed. Trivy was configured to fail on CRITICAL and HIGH severity findings, but every HIGH finding it reported was listed in `.trivyignore`. A gate whose every finding is excepted asserts nothing and is worse than no gate because it looks like assurance. The two genuine unfixed findings are recorded here with their cost reasoning instead:

- **No CloudFront WAF.** A managed WAF web ACL costs roughly **$5 per month**, about seven times the project's total monthly estimate. The application has no authentication, no user data and no admin surface, and the API is rate limited at the API Gateway stage, which covers the abuse case a WAF would address.
- **SSE-S3 rather than a customer-managed key.** Encryption at rest is in place; what is missing is key rotation, key policy control and KMS audit, which matter for sensitive data and are marginal for a bucket holding a public React bundle rebuilt on every deploy. A customer-managed key is about **$1 per month**.

The fixes that came out of the scanning exercise stay: SNS topic encryption and API Gateway throttling are real improvements and are not reverted.

`tflint` had reported zero findings since it was wired up, while costing a plugin download and two extra steps per run. The baseline checks cover what mattered in practice.

## Future improvements

Ordered by what would matter most rather than by effort.

1. **Server-issued puzzles.** The API cannot verify that a game was played, so a client can report
   any plausible `moves` and `elapsedMs` pair. Sending the board from the server and validating the
   submitted solution closes it, and it is the only change that makes the leaderboard trustworthy
   against a determined player.
2. **Credentials for the pipeline that do not expire.** The deploy job authenticates with the lab
   session's temporary credentials, so a stale token fails the checks for a reason unrelated to the
   change. OIDC would replace three repository secrets with a handful of workflow lines.
3. **A Lambda concurrency quota above ten**, or provisioned concurrency, so a burst scales instead
   of throttling.
4. **A scoring curve without a flat top.** Both factors are capped, so two genuinely different
   performances can score identically. Making the maximum asymptotic is a product decision rather
   than a technical one.
