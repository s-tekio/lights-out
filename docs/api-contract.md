# Ranking API contract

Frozen interface between `apps/web` and `apps/api`. Both applications are built against this
document; changing it is a coordinated change, not a local one.

## Conventions

- Base path: every route starts with `/api`. The same paths are used in local development, in the
  Vite dev proxy and behind CloudFront, so no rewrite rules exist anywhere.
- Content type: `application/json; charset=utf-8` for both requests and responses.
- Timestamps are ISO 8601 UTC strings.
- The **server** computes the score. The client never sends points; it only reports what happened
  in the game. A client-supplied score is ignored if present.

## `GET /api/health`

Liveness probe, also used by the dev proxy check.

```json
{ "status": "ok", "version": "0.1.0" }
```

## `POST /api/scores`

Registers the result of one finished game.

Request body:

```json
{
  "playerName": "Tekio",
  "boardSize": 5,
  "moves": 7,
  "elapsedMs": 42310
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `playerName` | string | Required. Trimmed. 1-24 characters. Only letters, digits, space, `_`, `-`, `.`. |
| `boardSize` | integer | Required. 3 to 9 inclusive. The API accepts a general range while the UI currently offers 3, 5 and 7; see the note below. |
| `moves` | integer | Required. 0 to 1000 inclusive. |
| `elapsedMs` | integer | Required. 0 to 86 400 000 inclusive (24 h). |

Responses:

- `201 Created` — the score was stored.

```json
{
  "score": {
    "id": "3f1c8f1e-6c0e-4a5e-9f4e-0a2b7c9d1e2f",
    "playerName": "Tekio",
    "boardSize": 5,
    "moves": 7,
    "elapsedMs": 42310,
    "points": 2290,
    "createdAt": "2026-09-24T12:00:00.000Z"
  },
  "rank": 3
}
```

- `400 Bad Request` — validation failed. See the error shape below.

## `GET /api/scores`

Returns the leaderboard.

Query parameters:

| Parameter | Type | Default | Rules |
| --- | --- | --- | --- |
| `limit` | integer | `10` | 1 to 100 inclusive. |
| `boardSize` | integer | all sizes | 3 to 9 inclusive. When present, only scores for that board size are returned. |
| `sort` | string | `points` | One of `points`, `elapsedMs`, `playerName`. |
| `order` | string | depends on `sort` | `asc` or `desc`. Defaults: `points` gives `desc`, `elapsedMs` gives `asc`, `playerName` gives `asc`. |

Response `200 OK`:

```json
{
  "items": [
    {
      "id": "3f1c8f1e-6c0e-4a5e-9f4e-0a2b7c9d1e2f",
      "playerName": "Tekio",
      "boardSize": 5,
      "moves": 7,
      "elapsedMs": 42310,
      "points": 2290,
      "createdAt": "2026-09-24T12:00:00.000Z"
    }
  ],
  "limit": 10,
  "boardSize": 5,
  "sort": "points",
  "order": "desc"
}
```

`boardSize` is `null` when no size filter was applied. `sort` and `order` echo the values that were
applied to the query, including any resolved defaults.

The change is additive and backwards compatible: omitting both `sort` and `order` reproduces the
previous behaviour exactly (`points` descending).

## Error shape

Every non-2xx response uses the same body:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Score submission is invalid.",
    "details": [{ "field": "moves", "message": "must be an integer between 0 and 1000" }]
  }
}
```

| Code | Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Request body or query parameters failed validation. |
| `NOT_FOUND` | 404 | Unknown route. |
| `METHOD_NOT_ALLOWED` | 405 | Known route, unsupported method. |
| `INTERNAL_ERROR` | 500 | Unexpected server failure. Internal details are logged, never returned. |

## Board size range

The API accepts any `boardSize` from 3 to 9. The UI currently offers three levels: 3, 5 and 7.

The accepted range is deliberately wider than the set of levels. Retuning which board sizes the
levels use must not force a contract change and an API deployment, and the level sizes have already
been retuned twice. Keeping the range general also keeps the API unaware of game options: it stores
and returns a board size, not a difficulty label. A score recorded at any accepted size stays
readable, which is what lets the UI render a level label for a size it recognises and fall back to
the plain size otherwise.

## Scoring formula

Points are computed server-side from the reported game outcome:

```
parMoves   = boardSize * 2                        (heuristic par, not the puzzle minimum)
base       = boardSize * boardSize * 100
movePenalty= max(0, moves - parMoves) * 25
timePenalty= floor(elapsedMs / 1000) * 5
points     = max(0, round(base - movePenalty - timePenalty))
```

`parMoves` is a deliberate heuristic: the true minimum number of presses for an arbitrary Lights
Out configuration is not a fixed value per board size. The formula is documented rather than
tuned, and the constants live in `apps/api/src/domain/score.ts`.

## Ordering

The canonical ranking used for `rank` in the `POST /api/scores` response is deterministic and
independent of the `sort`/`order` used to read the list:

1. `points` descending (better score first)
2. `elapsedMs` ascending (faster wins ties)
3. `createdAt` ascending (earlier submission wins remaining ties)

`rank` in the `POST` response is the 1-based position of the submitted score under that canonical
ordering, and it does not change when the list is later read with a different `sort` or `order`.

For `GET /api/scores`, every ordering appends the same stable tiebreaker chain so that equal values
never come back in arbitrary order:

1. the requested column and direction
2. `createdAt` ascending
3. `id` ascending

`playerName` ordering is case-insensitive. The order is: normalized (lowercased) name ascending,
then the original name ascending, then the tiebreaker chain. This matters because the DynamoDB
adapter will need a normalized attribute to reproduce the same order cheaply.

**String comparisons are by UTF-16 code unit, not locale collation.** This is not a detail.
`localeCompare` depends on the ambient locale, so the same data could order differently on a
workstation than in a Lambda runtime, and the DynamoDB adapter cannot reproduce locale collation
without a precomputed collation key. Code-unit order is defined and reproducible on both sides. Its
visible consequence is that inside a case-insensitive group `Ana` sorts before `ana`, because `A`
(U+0041) precedes `a` (U+0061).

## Known limitation

The API cannot verify that a game was actually solved. A client can report any plausible
`moves` / `elapsedMs` pair. Server-side score computation removes the ability to submit an
arbitrary point value, but not the ability to lie about the game. Anti-cheat is listed as future
work in the README rather than pretended to exist.
