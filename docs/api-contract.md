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
| `boardSize` | integer | Required. 3 to 7 inclusive. |
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
| `boardSize` | integer | all sizes | 3 to 7 inclusive. When present, only scores for that board size are returned. |

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
  "boardSize": 5
}
```

`boardSize` is `null` when no size filter was applied.

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

Leaderboard order is deterministic:

1. `points` descending (better score first)
2. `elapsedMs` ascending (faster wins ties)
3. `createdAt` ascending (earlier submission wins remaining ties)

`rank` in the `POST` response is the 1-based position of the submitted score under that ordering.

## Known limitation

The API cannot verify that a game was actually solved. A client can report any plausible
`moves` / `elapsedMs` pair. Server-side score computation removes the ability to submit an
arbitrary point value, but not the ability to lie about the game. Anti-cheat is listed as future
work in the README rather than pretended to exist.
