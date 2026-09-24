# Feature: lights-out-scoring-and-test-layout

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-09-24
**Workflow:** ODD (Organic Driven Development)

## Goal

Two changes requested after the user reviewed the running app: move every test file into a `test/`
directory per application, and fix the scoring formula, which silently collapses to zero.

## Origin

1. **Test layout.** The user, a Symfony developer, asked for `test/` folders in `apps/api` and
   `apps/web` mirroring the `src/` structure.
2. **Scoring.** The user submitted a real game and saw `0` points on Easy, and asked how that was
   possible.

### Premise corrected

The user justified the test move with "so it is easier to set up CI/CD with GitHub Actions". **That
reason does not hold.** Vitest discovers tests by glob, not by directory, so `vitest run` finds them
either way, and the existing pipeline already ran all 199 tests without knowing where they live.

The change was still made, on its own merits: it separates what ships from what does not at the
structural level, it matches the team's convention, and the 1:1 reflection between
`test/game/board.test.ts` and `src/game/board.ts` is easy to navigate. The cost was stated too:
co-location is the dominant convention in the JavaScript ecosystem, and a module rename no longer
carries its test along.

## The scoring defect

Not an implementation bug: the formula did exactly what it said. `par = boardSize × 2` is a fixed
base minus unbounded linear penalties, clamped with `max(0, …)`. The clamp is a **recorte, not a
floor**, so everything past the break-even point collapses into one indistinguishable zero.

The user's game: Easy 3×3, 71 moves, 1:06.

```
base = 900        penalty moves = (71 − 6) × 25 = 1625        penalty time = 66 × 5 = 330
900 − 1625 − 330 = −1055  →  max(0, …)  →  0
```

Measured saturation points:

| Level | Base | Zeroes out beyond | Zeroes out at |
| --- | --- | --- | --- |
| Easy 3×3 | 900 | 3:00 of play, regardless of skill | 43 moves |
| Normal 5×5 | 2500 | 8:20 | 111 moves |
| Hard 7×7 | 4900 | 16:20 | 211 moves |

A **perfect** Easy game of three moves scores 750 at 30 s, 600 at 60 s, 300 at 120 s and **0 at
180 s**. Below the break-even point the ordering is decided by the clock, not by play, and most
casual Easy games land there.

Root cause shared with the earlier finding about the heuristic par: the score is an **absolute
subtraction against a fixed base**. A subtraction has a zero crossing, and past it the information is
destroyed.

## Decisions taken

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Test layout | `apps/<app>/test/**` mirroring `src/**` | Requested; legitimate for the real reasons above. The CI justification was corrected, not accepted. |
| `apps/api` build config | Split into `tsconfig.json` (typecheck and lint, `src` + `test`, `noEmit`) and `tsconfig.build.json` (build, `src` only, emits to `dist`) | The build uses `tsc` with `rootDir: src`. Adding `test/**` to the same project breaks it with "file is not under rootDir". |
| Scoring shape | Multiplicative and bounded: `points = round(base × moveFactor × timeFactor)` | A product of factors in (0, 1] cannot saturate. Every extra move and every extra second still lowers the score, with no plateau. |
| `moveFactor` | `min(1, par / max(1, moves))` | 1.0 at par or better, decaying smoothly. Becomes a true efficiency ratio once the server issues puzzles and `par` is replaced by the board's real minimum. |
| `timeFactor` | `min(1, referenceMs / max(1, elapsedMs))`, `referenceMs = boardSize² × 2000` | 18 s / 50 s / 98 s. Tuning values, and stated as such: the shape is the fix, the constants get calibrated by playing. |
| Fractional time | Use `elapsedMs` directly instead of flooring to seconds | Removes a one-second quantisation step from the factor. |
| Maximum score | Equals the level's base: 900 / 2500 / 4900 | Falls out of both factors being capped at 1, and makes a harder level worth more. |

## Tasks

- [x] **T1 — Test layout.** Move every test file into `test/` in both applications, mirroring `src/`,
  and update the `tsconfig` files, the Vitest configs and every import path. No behaviour change.
- [x] **T2 — Multiplicative scoring.** Replace the additive formula, update the contract's scoring
  section, and update the help dialog copy, which currently describes penalties that will no longer
  exist. Update the affected tests.
- [ ] **T3 — Verification.** Independent verification of both.

## Evidence log

| Task | Commit | Evidence |
| --- | --- | --- |
| T1 | bookkeeping | 14 files moved with `git mv`, and `find` confirms no `*.test.ts(x)` remains under either `src/`. Parent verification: lint, format, typecheck, 199 tests and build all green. Coverage unchanged at API 86.57 / 90 / 100 and web 94.16 / 93.54 / 94.36, which proves the measured set did not change. `apps/api/dist/local-server.js` still exists and no test is emitted into `dist`. `npm run lint` reported no `projectService` problem with two tsconfig projects present. |
| T2 | this commit | Formula replaced with the bounded product. 205 tests (98 API, 107 web). Parent verification: 0 mismatches against an independent reimplementation of the spec over 18 963 input combinations, 0 bound violations and 0 monotonicity violations. Motivating cases: the user's game 21 (was 0), a perfect Easy game at 3:00 at 90 (was 0), the 43 moves that used to zero it now 126, and an absurd input still 0. Contract examples recomputed from 2290 to 2500. |

## Process note

The writer task for T2 was given surfaces that excluded `apps/api/test/application`,
`apps/api/test/http` and the web test fixtures, so three assertions on the computed point value were
left failing and the writer correctly reported them instead of editing outside its scope. That was a
specification error by the parent, not a writer error. The parent fixed the three assertions.

Fixture values elsewhere (`points: 2_290` in router fixtures, `points: 2290` in web fixtures) were
deliberately left alone. They are arbitrary input data for ordering and rendering tests, not computed
outputs, and two router fixtures even reuse the same value for different board sizes, which a real
formula output could not do. Changing them would be churn with no effect on what the tests prove.
The one historical record of `points: 2290` in `odd/tasks/lights-out-bootstrap.md` is also untouched:
it records what the server returned at that commit under the old formula, and editing an evidence log
to match a later change would falsify the record.

## Known limitations after this change

- `par = boardSize × 2` remains a heuristic unrelated to the board, so `moveFactor` is still not a
  true efficiency ratio. It becomes one only when the server issues the puzzle.
- Absurd inputs still round to zero: on Easy it now takes roughly `moves × seconds > 194 000`, so
  about 650 moves sustained for five minutes, against 43 moves before.
- Existing stored scores keep their old point values. Only new submissions use the new formula.
