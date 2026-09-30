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

## Optimal solution, computed on the client

After a player solves a board the game can reveal how many presses the optimal solution needs, and
which cells it uses. That computation runs entirely in the browser and needs no request.

The trick is that the **client generated the board**, so it already knows a solution: the scramble
press set `S` returned by `createSolvableBoard`. Every solution of the board lies in the coset
`S + ker(A)` over GF(2), so

```
optimal presses = min over v in ker(A) of |S Δ v|
optimal plan    = the coset representative that achieves it
```

There is no search. The kernel is a property of the board **size**, not of the board, so it is
computed once with Gauss-Jordan elimination over GF(2) and cached. Its dimensions are 0 for 3×3, 2
for 5×5 and 0 for 7×7, so there are at most four candidates to compare. The kernel cannot be skipped:
it lowers the minimum on some 5×5 boards, so ignoring it would display a wrong optimum.

Two things are worth remembering about this code:

- **`BigInt` is mandatory.** A 7×7 board has 49 cells and JavaScript bitwise operators truncate to 32
  bits. This is the same trap that produced the silent bug in `solver.ts`, and it would reappear here
  with `number` masks.
- **It only works while the client knows how the board was generated.** If the server ever issues
  puzzles, this derivation moves with it. It is recorded here so that change is not a surprise.

Why this is a good place for the feature: the optimal solution is a **plan**, not a suggestion.
Pressing a cell outside the optimal set makes the board require one more press, so a hint shown
during play can leave a player worse off than not looking. After the game is over that requirement
disappears and the reveal is purely informative.

This also does not change the security posture. The solution is already derivable from the client
today, because the scramble lives there. Verifying that a game was actually played still requires
server-issued puzzles, exactly as the known limitations say.

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

Each score is stored as **one item**. The item carries both `allScope` and `boardScope`, and the
six GSIs provide every query path. There are two query shapes (all scores vs. one board size)
times three sort dimensions (`points`, `elapsedMs`, `playerName`). Direction is handled by
`ScanIndexForward`, not by extra indexes.

### Partition note

The three `all`-scoped indexes have a single partition key value: `"all"`. That is unavoidable,
because "the leaderboard across every board size" is one partition by definition and cannot be
sharded without breaking global ordering. The three `board`-scoped indexes are sharded by board
size. A single DynamoDB partition caps at roughly 3 000 read capacity units and 1 000 write
capacity units per second. That ceiling is irrelevant at this scale and a real constraint at much
larger ones.

### Why there is no transaction

`save` uses a single `PutItem`. The previous design stored each score as two items (one global copy
and one per-board copy) and needed `TransactWriteItems` to keep them consistent. The Lambda
execution role is explicitly scoped to `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`,
`BatchGetItem`, `BatchWriteItem`, `Query`, `Scan`, `DescribeTable`, `ListTables` and
`ConditionCheckItem`; `TransactWriteItems` is not included, and IAM management is denied in this
environment so the policy cannot be extended. Storing one item removes the consistency problem
entirely: a single `PutItem` is atomic by construction, so the missing permission no longer matters.

### Sort-key encodings

`#` is a safe separator: player names are allow-listed to `[A-Za-z0-9 _\-.]`, `createdAt` is ISO
8601, and `id` is a UUID, so none of them can contain it.

| GSI | Sort key | Natural direction |
| --- | --- | --- |
| `by-points-*` | `pad6(999999 - points) + '#' + pad9(elapsedMs) + '#' + createdAt + '#' + id` | `points` descending |
| `by-time-*` | `pad9(elapsedMs) + '#' + createdAt + '#' + id` | `elapsedMs` ascending |
| `by-player-*` | `playerNameLower + '#' + playerName + '#' + createdAt + '#' + id` | `playerName` ascending |

Why `pointsKey` works: subtracting `points` from a fixed maximum inverts the comparison, so
ascending `pointsKey` order is descending points. The `elapsedMs`, `createdAt` and `id` components
then break ties the way the contract requires, and the trailing `id` makes the key unique so two
identical results cannot collide.

### The mirror rule

A DynamoDB `Query` can read a sort key forward (`ScanIndexForward = true`) or backward
(`ScanIndexForward = false`), but it cannot reverse only the leading component while leaving the
remaining components ascending. Reversing the whole key gives the exact mirror of the natural
direction, including the tiebreakers. That is the ordering guarantee the contract documents.

| Sort column | Natural direction | `ScanIndexForward` for natural order | Mirror order |
| --- | --- | --- | --- |
| `points` | descending | `true` (the key itself is inverted) | `points` asc, then `createdAt` desc, then `id` desc |
| `elapsedMs` | ascending | `true` | `elapsedMs` desc, then `createdAt` desc, then `id` desc |
| `playerName` | ascending | `true` | normalized desc, then original desc, then `createdAt` desc, then `id` desc |

The boolean mapping ends up uniform — forward for the natural direction, backward for the mirror —
because every sort key is encoded so that ascending key order is the natural direction. The
non-uniformity is in the key encoding, not in the `ScanIndexForward` value.

### Rank calculation

`rankOf` performs a single `Query` with `Select: COUNT` over `pointsKey < :thisPointsKey` on the
`by-points-all` index with `allScope = "all"`, plus one. No table scan, no client-side sorting, and
the cost is proportional to the number of scores ahead of the submitted one. A concurrent write
between the `PutItem` and the count query can shift the reported rank by one; this is inherent to a
leaderboard and is not hidden behind a transaction.

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
| `localStorage` unavailable | Reads and writes are swallowed; the game works without persistence. | `components/StatusPanel.tsx` |

Expected client errors are **not** logged at error level. This is deliberate: a leaderboard where
every mistyped name emits an error-level log makes any CloudWatch alarm on errors useless.

## Security posture

| Property | How it is achieved |
| --- | --- |
| No secrets in the application | There are none to hold. No database credentials, no API keys. IAM grants the Lambda access to DynamoDB, so nothing is stored in configuration. |
| Least privilege (planned) | One role per Lambda, scoped to the `scores` table and its indexes, with explicit actions on explicit ARNs. No wildcards, no `*FullAccess` managed policies. |
| Encryption in transit | CloudFront serves HTTPS only; plain HTTP is redirected. |
| Encryption at rest | DynamoDB encrypts at rest by default; S3 uses SSE. |
| Input validation | Player names pass an allow-list; numbers are bounded and integer-checked. This happens server-side, so a modified client changes nothing. |
| No internal leakage | Error responses carry a code and a message, never a stack trace or a driver error. |
| No public data exposure | The S3 bucket is private and served only through CloudFront with an origin access control. |

Known gaps, stated rather than implied: **no authentication**, **no rate limiting**, and **no
ability to verify that a submitted game was actually played**. All three are listed in the README's
known limitations and roadmap.

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
custom cache policies replace the previous AWS-managed policy and the `local-exec` invalidation:

| Path pattern | Cache policy | TTL | Purpose |
| --- | --- | --- | --- |
| `/*` (default) | `index.html` | `min_ttl = 0`, `default_ttl = 0`, `max_ttl = 0` | Never cache `index.html`; it references hashed assets and must be fresh. |
| `/assets/*` | `assets` | `min_ttl = 0`, `default_ttl = 31536000`, `max_ttl = 31536000` | Cache immutable hashed assets for a year. |

Both policies include only the URL path in the cache key: no cookies, headers or query strings are
forwarded, and gzip compression is enabled. S3 objects are uploaded with matching `Cache-Control`
metadata: `no-cache` for `index.html` and `public, max-age=31536000, immutable` for everything under
`assets/`. Because a new build changes the hashed asset filenames in `index.html`, no explicit
invalidation is required.
