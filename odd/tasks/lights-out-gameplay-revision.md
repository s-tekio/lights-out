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

Consequence: the `minPresses` guarantee for Hard was not enforced at all, and the solver was simply
wrong above 32 cells. Moving to 9×9 (81 cells) would have made it worse.

## Decisions taken

| Decision | Chosen | Rationale |
| --- | --- | --- |
| Solver representation | Boolean-array depth-first search | A correct, obviously verifiable search beats a clever bitmask that was silently wrong. The search is small at the values used: `1 + n + C(n,2)` nodes, so 3322 for 9×9. |
| Minimum presses | 3 for every difficulty | Uniform, and the check costs `isSolvableWithin(board, 2)`. On 5×5, 7×7 and 9×9 the natural minimum is far higher, so this is a safety net rather than the difficulty lever. |
| Difficulty lever | Board size and scramble depth | Not `minPresses`. Finding three specific cells among eighty-one is not what makes a puzzle feel easy. |
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
| T3, T4 | `3a9d34b` | Parent verified the leaderboard still sends `boardSize` on the wire and the contract is untouched. 170 tests total (71 API, 100 web), web coverage 93.78%. |

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
