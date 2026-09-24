# Feature: lights-out-gameplay-revision

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-09-24
**Workflow:** ODD (Organic Driven Development)

## Goal

Revise the gameplay after the first playable version: fix a correctness defect in the puzzle solver,
change the board sizes, replace the leaderboard's board-size filter with a difficulty filter, and add
an in-game help dialog.

## Origin

Requested by the user after testing the first version locally:

1. Easy difficulty could sometimes be finished in a single move.
2. Board sizes should become Easy 5×5, Normal 7×7, Hard 9×9.
3. The leaderboard filter should select by difficulty level, not by board size.
4. Add a help button opening a dialog that explains the rules and the game's options.

The user justified the size change by stating that the board must be a multiple of 3. **That premise
is incorrect** and was corrected in the response: the board is always square, and the kernel
dimension of the toggle matrix varies irregularly with the size (0 for 3, 6, 7, 8; 2 for 5; 4 for 4;
8 for 9). Three is not special. The size change was implemented on its own merits as a difficulty
decision, not because of that reason.

## Defect found during this work

`solver.ts` stored the board in a JavaScript number bitmask built with `1 << index`. JavaScript
bitwise operators truncate to 32 bits, so on a 7×7 board (49 cells) bits 32..48 fold back onto bits
0..16. The fold is a linear map, so the search returns a press set whose folded XOR is zero rather
than the real XOR.

Measured against an independent boolean-array reference:

| Case | Result |
| --- | --- |
| Constructed counterexample | bitmask `true`, reference `false` |
| All 49 single-press boards | 0 mismatches — which is why the previous tests passed |
| 1000 seeded random 7×7 boards | 44 mismatches, in both directions |

**Reproducibility caveat.** The buggy implementation was never committed: `solver.ts` did not exist
before `d360a5f`. The measurements above were taken in-session against uncommitted code, so they
cannot be re-measured from the repository history. The counterexample board, however, is committed
as a regression test, and it provably fails against the old behaviour. Independent verification
therefore confirmed the *fix* rather than the historical measurement.

Consequence: the `minPresses` guarantee for Hard was not enforced at all, and the solver was simply
wrong above 32 cells. Moving to 9×9 (81 cells) would have made it worse.

## Decisions taken

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Solver representation | Boolean-array depth-first search | A correct, obviously verifiable search beats a clever bitmask that was silently wrong. The search is small at the values used: `1 + n + C(n,2)` nodes, so 3322 for 9×9. |
| Minimum presses | 3 for every difficulty | Uniform, and the check costs `isSolvableWithin(board, 2)`. On 5×5, 7×7 and 9×9 the natural minimum is far higher, so this is a safety net rather than the difficulty lever. |
| Difficulty lever | Board size and scramble depth | Not `minPresses`. Finding three specific cells among eighty-one is not what makes a puzzle feel easy. |
| Levels and scramble depths | Easy 5×5 depth 10, Normal 7×7 depth 20, Hard 9×9 depth 35 | Recorded here because the scramble depth is not derivable from anything else: it is a tuning value. |
| API board size range | Widened from 3..7 to 3..9 | Widening keeps every previously accepted value valid, so it is backwards compatible. The API accepts a general range; the UI offers the three levels. |
| Leaderboard filter | Levels in the UI, `boardSize` on the wire | The level is a UI label that can be relabelled; the board size is the durable fact about a score. Keeping `boardSize` in the contract means the API does not need to know about game options. |
| Modal implementation | Hand-rolled dialog, not native `<dialog>` | jsdom 26 does not implement `HTMLDialogElement.showModal()`, so a native dialog could not be exercised by tests. A shim would make the tests assert the shim rather than the behaviour. |

## Tasks

- [x] **T1 — Fix the solver.** Replace the 32-bit bitmask with a boolean-array search, and add a
  regression test that compares against an independent reference on boards larger than 32 cells.
- [x] **T2 — New board sizes.** Easy 5×5, Normal 7×7, Hard 9×9, with scramble depths, and widen the
  API contract's `boardSize` range to 3..9 in the contract document and the server validation.
- [x] **T3 — Leaderboard filter by level.** Replace the board-size selector with a difficulty
  selector, mapping level to `boardSize` on the wire.
- [x] **T4 — Help dialog.** A help button opening an accessible modal that explains the rules, the
  available options and how results reach the leaderboard.
- [ ] **T5 — Verification.** Independent verification of all of the above.

## Known consequences

- Historical scores recorded under the old level mapping keep their board size, so a 5×5 score
  submitted when 5×5 meant "Normal" will now be labelled "Easy". Accepted: the local store is
  in-memory and this is a practice project. Storing the board size rather than the label is what
  keeps the data meaningful.
- A 9×9 board is 81 buttons. On a narrow phone viewport each cell is around 38 px, slightly under the
  44 px tap-target guideline. The styles must keep the board usable at that width.

## Evidence log

| Task | Commit | Evidence |
| --- | --- | --- |
| T1, T2 | `d360a5f` | Parent verification, independent of the writer's own reference: anchored both the solver and a fresh reference against full brute force on 3×3 (0 mismatches); the exact counterexample now returns `false`; 1000 random 7×7 and 1000 random 9×9 boards cross-checked at `maxPresses` 0..2 with **0 mismatches**; 300 generated boards per difficulty with **0/300 below `minPresses`**. 148 tests total (71 API, 77 web). |
| T3, T4 | `3a9d34b` | Parent verified the leaderboard still sends `boardSize` on the wire and the contract is untouched. 171 tests total (71 API, 100 web), web coverage 93.78%. |

## Process notes

The writer's report for T1/T2 flagged that the worktree already contained uncommitted changes. That
was correct: the earlier delegation that introduced `minPresses` was never verified or committed
because the user's next request arrived first. Its changes and this one are entangled in the same
lines of `difficulty.ts` and `solver.ts`, so no clean split into two commits was possible and both
land in one work unit.

Two corrections were applied by the parent on top of the writer's output:

| Correction | Reason |
| --- | --- |
| Rewrote the test reference to mutate a boolean array in place instead of allocating one per node. | `solver.test.ts` took 24 046 ms, which is a 7× slowdown of the whole web suite. It now takes 9 461 ms with identical coverage. |
| Verified the regression test has teeth rather than assuming it. | The test's counterexample is byte-for-byte the construction measured against the buggy implementation, which returned `true` where the reference returns `false`. The test therefore provably fails against the old code. |
| Fixed focus stealing in `HelpDialog` on page load, with the regression test written first and observed failing. | The focus-restore effect ran on mount as well as on close, so the Help button took focus on page load and dropped a screen reader user into the header instead of the start of the document. |
| Updated the README, which had gone stale. | It still advertised 3×3/5×5/7×7, a board-size filter, 124 tests and 94% web coverage. |
| Corrected a test-count error that independent verification caught. | The README and this document both said 170 tests; the real total is 171 (71 API + 100 web). |

## Revision 2 — levels reverted, server authority recorded

After playing the 5×5/7×7/9×9 version the user judged 5×5 too short for Easy and asked for the
previous levels back. The board module's guard range stays at 3..9 so it mirrors what the API can
return rather than the set of levels; only `DIFFICULTIES` changed.

| Difficulty | `boardSize` | `scrambleDepth` | `minPresses` |
| --- | --- | --- | --- |
| easy | 3 | 5 | 3 |
| normal | 5 | 15 | 3 |
| hard | 7 | 30 | 3 |

On 3×3 the parity set of five presses has an odd size, so it can only be 1, 3 or 5. Rejecting size 1
leaves 3 or 5, which is what the `minPresses` guarantee now enforces on this board.

The API keeps accepting 3..9 even though the levels only use 3, 5 and 7. The reason is recorded in the
contract: the level sizes have already been retuned twice, and each retune would otherwise force a
contract change and an API deployment. A wider accepted range also keeps the API unaware of game
options, which is what lets a score recorded at any accepted size stay readable.

The leaderboard's server authority was confirmed against the code and recorded in
`docs/architecture.md`: the client holds no score state, the only local value is the player's name,
and every load, filter change and refresh issues a real request. This is a constraint to preserve
through the DynamoDB work, not an accident of the current implementation.

### Test data must be derived, not hardcoded

The level retune broke five tests that had hardcoded board sizes (5, 7 and 9) and level labels. The
fix was to derive the expected values from `DIFFICULTIES` rather than substituting new literals: the
label format is the behaviour under test, while the sizes are tuning values that get retuned. A test
that pins a tuning value fails for the wrong reason and invites a copy-paste fix that leaves the next
retune just as fragile.

## Known test limitation

The help dialog currently has exactly one focusable element, its Close button. The Tab and Shift+Tab
tests therefore assert that focus stays inside the dialog rather than proving a wrap between two
distinct elements. Focus containment is the property that matters and it is covered; the wrap logic
itself is written for the general case and was checked by reading, not by a test. Adding a second
focusable element to the dialog would close this gap.
