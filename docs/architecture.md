# Architecture

Companion to the architecture decision in the [README](../README.md). That document explains *why*
serverless; this one explains *how* the pieces fit and what the AWS data model will look like.

## Components

| Component | Responsibility | Current state |
| --- | --- | --- |
| `apps/web` | Renders the puzzle, tracks moves and time, submits results, renders the leaderboard. | Implemented |
| `apps/api` domain | Scoring formula and input validation. Pure functions, no I/O. | Implemented |
| `apps/api` application | Use cases: submit a score, list the leaderboard. | Implemented |
| `apps/api` ports | `ScoreRepository`. The seam between business logic and storage. | Implemented |
| `apps/api` adapters | `InMemoryScoreRepository`. `DynamoDbScoreRepository` is planned. | In-memory only |
| `apps/api` http | Framework-agnostic router plus a thin Lambda adapter and a local `node:http` server. | Implemented |
| `infra` | Terraform for CloudFront, S3, API Gateway, Lambda, DynamoDB, IAM, alarms, budgets. | Not implemented |

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

## Planned DynamoDB data model

**Not implemented yet.** Recorded here so the adapter is written against a deliberate design
rather than discovered by trial.

The contract requires an exact ordering: `points` descending, then `elapsedMs` ascending, then
`createdAt` ascending. DynamoDB sorts sort keys ascending, so the ordering is encoded into the key
with inverted components.

| Concern | Design |
| --- | --- |
| Table | `scores`, on-demand billing, point-in-time recovery enabled, deletion protection on |
| Partition key | `id` (UUID v4), for the write path |
| Attributes | `playerName`, `boardSize`, `moves`, `elapsedMs`, `points`, `createdAt` |
| GSI `leaderboard-by-board-size` | PK `boardSize`, SK `rankKey` |
| GSI `leaderboard-all-sizes` | PK `allSizes` (constant), SK `rankKey` |
| `rankKey` | `pad(999999 - points, 6)` + `'#'` + `pad(elapsedMs, 9)` + `'#'` + `id` |

Why `rankKey` works: subtracting `points` from a fixed maximum inverts the comparison, so ascending
`rankKey` order is descending `points`. The `elapsedMs` component then breaks ties the way the
contract requires, and the trailing `id` makes the key unique so two identical results cannot
collide.

Rank calculation becomes a single `Query` with `Select: COUNT` over `rankKey < :thisRankKey` in the
same partition, plus one. No table scan, no client-side sorting, and the cost is proportional to the
number of scores ahead of the submitted one.

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
| Storage | In-memory | DynamoDB | **Not equivalent.** Ordering is reproduced in code; consistency semantics are not. |
| TLS | None | CloudFront | Different |
| CORS | Permissive headers from the router | API Gateway plus router headers | Equivalent for this use |

The storage row is the honest gap. The in-memory adapter reproduces the contract's ordering but not
DynamoDB's read consistency or its conditional-write behaviour, which is why the DynamoDB adapter
needs its own integration tests rather than reusing the in-memory ones.
