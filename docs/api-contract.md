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
    "points": 2500,
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
      "points": 2500,
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
parMoves    = boardSize * 2                                   (heuristic par, not the puzzle minimum)
base        = boardSize * boardSize * 100
referenceMs = boardSize * boardSize * 2000
moveFactor  = min(1, parMoves / max(1, moves))
timeFactor  = min(1, referenceMs / max(1, elapsedMs))
points      = max(0, round(base * moveFactor * timeFactor))
```

`moveFactor` is 1.0 when the player finishes at or below the heuristic par, then decays smoothly
as moves increase. `timeFactor` is 1.0 when the player finishes at or below the reference duration
(18 s for 3×3, 50 s for 5×5, 98 s for 7×7), then decays smoothly as time increases. The maximum
score for a level is therefore its `base`: 900 for Easy, 2500 for Normal, 4900 for Hard.

**Known ceiling.** Both factors are capped, so the score is flat above the reference: any game with
`moves <= parMoves` and `elapsedMs <= referenceMs` scores exactly the base, and play faster or more
efficient than that is not rewarded. The flat region is large, because both references are generous:

| Level | Base reached by any game with |
| --- | --- |
| Easy 3×3 | moves <= 6 and time <= 18 s |
| Normal 5×5 | moves <= 10 and time <= 50 s |
| Hard 7×7 | moves <= 14 and time <= 98 s |

Reported from real play: three Easy games of 3 moves in 1 s, 3 moves in 2 s and 5 moves in 3 s all
scored 900, despite not being equivalent performances.

This is deliberate and postponed, not overlooked. A capped score **cannot** reward being faster than
the next player inside the flat region: that requires a strictly decreasing factor, which makes the
maximum asymptotic and unattainable. That trade-off is a product decision still to be taken, and it
is recorded here so it is not rediscovered as a bug.

Moving the computation to the server does **not** fix this. Server-issued puzzles fix `parMoves`,
because the server then knows each board's real minimum, and they make the anti-cheat check possible.
The ceiling is a property of `min(1, …)` and is independent of where the score is computed.

Separately, `parMoves` itself is miscalibrated in both directions, measured over generated boards:

| Level | `parMoves` | Real minimum | Optimal play penalised on |
| --- | --- | --- | --- |
| Easy 3×3 | 6 | 3 to 5 (median 3) | 0/60 boards, so the move dimension never discriminates |
| Normal 5×5 | 10 | 5 to 13 (median 9) | 15/60 boards |
| Hard 7×7 | 14 | 10 to 22 (median 18) | 46/60 boards |

`parMoves` is a deliberate heuristic: the true minimum number of presses for an arbitrary Lights
Out configuration is not a fixed value per board size. Once the server issues puzzles and knows
each board's real minimum, `parMoves` can be replaced by that minimum and `moveFactor` becomes a
true efficiency ratio. The constants live in `apps/api/src/domain/score.ts`.

### Why the formula changed

The previous formula was a fixed base minus unbounded linear penalties, clamped with `max(0, …)`:

```
points = max(0, round(base - max(0, moves - parMoves) * 25 - floor(elapsedMs / 1000) * 5))
```

That clamp is a cut, not a floor: every result past the break-even point collapsed into the same
indistinguishable zero. Measured saturation points:

| Level | Base | Zeroed out beyond | Zeroed out at |
| --- | --- | --- | --- |
| Easy 3×3 | 900 | 3:00 of play, regardless of skill | 43 moves |
| Normal 5×5 | 2500 | 8:20 | 111 moves |
| Hard 7×7 | 4900 | 16:20 | 211 moves |

A perfect Easy game of three moves scored 750 at 30 s, 600 at 60 s, 300 at 120 s and 0 at 180 s. A
real user submitted Easy 3×3 in 71 moves and 1:06 and got 0. The multiplicative formula replaces
the subtraction with a product of two factors in `(0, 1]`, so every extra move and every extra
second keeps lowering the score without ever saturating at zero.

Existing stored scores keep their old point values. Only new submissions use the new formula.

### Worked example

For `boardSize 5`, `moves 7`, `elapsedMs 42310`:

```
base        = 5 * 5 * 100           = 2500
parMoves    = 5 * 2                 = 10
referenceMs = 5 * 5 * 2000          = 50000
moveFactor  = min(1, 10 / 7)        = 1
timeFactor  = min(1, 50000 / 42310) = 1
points      = round(2500 * 1 * 1)   = 2500
```

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
