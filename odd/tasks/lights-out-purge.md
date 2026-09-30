# Feature: lights-out-purge

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-09-25
**Workflow:** ODD (Organic Driven Development)

## Goal

Add a way to clear the whole leaderboard, so accumulated test data can be removed without destroying
and recreating the table.

## Origin and decision

The user asked for the capability, knowing that a real deployment would gate it behind a login and an
admin role. They chose, over a token in SSM Parameter Store and over a local CLI script, a **public
endpoint with an AWS-style typed confirmation**.

The reasoning that decided it: **anything the browser can call is effectively public**, because a token
the UI holds travels to the client and stops being a secret. So a purge reachable from the UI cannot
be protected without real authentication, and pretending otherwise would be theatre.

## Contract

`DELETE /api/scores` with a required query parameter `confirm` whose value must be exactly `DELETE`.

| Case | Response |
| --- | --- |
| `confirm=DELETE` | `200` with `{ "deleted": <count of items actually removed> }` |
| missing or any other value | `400 VALIDATION_ERROR` with a detail naming `confirm` and stating the required value |

The response reports how many items were removed. A silent destructive operation is worse than
useless: the caller cannot tell whether it did anything.

**The documentation must state plainly that this is accident prevention, not authentication.** Anyone
who can reach the API can wipe the leaderboard. That belongs in the contract and in the README's known
limitations, not buried.

## Implementation notes

- The execution role grants `Scan`, `DeleteItem` and `BatchWriteItem`, so the purge is a scan to
  collect keys followed by batched deletes in chunks of 25. A full scan is proportional to table size,
  which is irrelevant here and would not be at scale.
- `BatchWriteItem` can return `UnprocessedItems`, and a purge that silently left items behind would be
  worse than one that failed. Retry a bounded number of times, and if items remain, fail rather than
  report success. The purge is idempotent, so a client can simply retry it.
- `deletion_protection_enabled` protects the **table**, not its items, so it does not obstruct a bulk
  delete. Worth knowing rather than assuming otherwise.
- Both adapters must implement the purge and both must satisfy the **shared contract suite**, which is
  how they have been kept from drifting.

## Tasks

- [x] **T1 — Port and adapters.** `deleteAll` on `ScoreRepository`, implemented in the in-memory and
  DynamoDB adapters, plus shared-contract coverage so both are held to the same behaviour.
- [x] **T2 — Contract and HTTP layer.** The `confirm` validation rule, `purgeScores` in the
  application layer, the `DELETE` route, and the contract document.
- [x] **T3 — Frontend.** Extract the modal mechanics shared with the help dialog, add the purge dialog
  requiring the typed confirmation, the leaderboard button, the API client function and the tests.
- [x] **T4 — Documentation.** The contract, `docs/architecture.md`, and the README known limitations.
- [ ] **T5 — Verification.** Local, then live against the deployed API once the user applies.

## Status

The purge is implemented and verified locally. Commits `7d8e6d0` (API) and `1a25814` (frontend).
**341 tests** pass (174 API, 167 web) with the DynamoDB integration tests running rather than
skipping, both coverage gates exit 0, and the Lambda bundle's load-and-invoke check passes.

| Verified locally | Evidence |
| --- | --- |
| A rejected confirmation deletes nothing | My own smoke test: after `confirm=delete` (lowercase) and after no `confirm` at all the response was 400 **and the count stayed at three**. This is the property that matters most: a refused request that still wiped the data would be the worst outcome. |
| The exact confirmation works and is idempotent | `confirm=DELETE` returned `{"deleted":3}` and an empty leaderboard; a second call returned `{"deleted":0}`. |
| Both adapters agree | The `deleteAll` cases live in the shared contract suite, which runs against the in-memory and the DynamoDB adapter alike. |
| DynamoDB unprocessed items | Retried a bounded number of times; a persistent failure is thrown rather than reported as a short count, and that is covered by a unit test. |
| The focus fix survived the extraction | The extracted `Modal` keeps the `wasOpenRef` guard with its comment, and `HelpDialog` contains no modal logic of its own. |
| No cast on the purge response | A real type guard plus `MalformedResponseError`. |

## Not yet verified

The purge has never run against the deployed API. That needs the user's `apply` to ship the new
Lambda code, and it doubles as the cleanup of the nine test scores left in the table by the previous
verification round.

The purge button itself cannot be exercised live until the frontend is hosted, which is slice 2.
Until then the UI path is covered by component tests only.

## Known limitation to record

With no authentication, anyone who knows the URL can wipe the leaderboard. The typed confirmation
prevents accidents, not intent. A real deployment needs a login and an admin role.
