# Feature: lights-out-optimal-reveal

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-09-24
**Workflow:** ODD (Organic Driven Development)

## Goal

After a player solves a board, reveal how many presses the optimal solution needs and, on demand, the
sequence of presses themselves.

## Origin

The user asked whether a hint button for the next move was viable, and whether it even made sense.
The assessment was:

- Technically, an interactive hint that searches for the minimum from scratch is **impossible** on
  7×7: the real minimum is 10-26 (median 18), so the search would need on the order of 2.4×10¹³
  nodes, about 40 days at the measured rate, while `k=4` alone already takes 33 ms.
- As an unlimited in-game hint it would destroy the game, because the skill *is* finding the
  solution, and it would hollow out the leaderboard.
- The optimal solution is a **plan**, not a suggestion: pressing a cell outside the optimal set makes
  the board require one more press. So looking at a hint and then improvising leaves the player
  worse off than not looking.

The user chose the post-game reveal, with both the number and the sequence, and this document
records that decision.

## Key insight that makes this cheap

The client **generated** the board, so it already knows a solution: the scramble press set `S`.
Every solution of the board is in the coset `S + ker(A)`, so:

```
optimal presses = min over v in ker(A) of |S Δ v|
optimal plan    = the coset representative achieving that minimum
```

No search. The kernel is a property of the board **size**, not of the board, so it is computed once
and cached. For the three supported sizes the kernel dimensions are 0, 2 and 0, so there are at most
four candidates to compare.

This also means **no API change**: no new endpoint, no contract change, no deployment. The whole
feature is client-side.

## Verification done before writing production code

| Check | Result |
| --- | --- |
| Kernel dimension per size | 3×3 → 0, 4×4 → 4, 5×5 → 2, 7×7 → 0, 9×9 → 8 |
| Kernel property, checked directly | Each 5×5 basis element pressed on a solved board leaves it solved |
| Coset minimum versus brute force | **0 mismatches**: 400 scrambles on 3×3 (cap 9), 8 on 5×5 (cap 11) |
| Does the kernel matter? | Yes: it lowered the minimum in **1 of 8** 5×5 scrambles |

That last row is why the kernel cannot be skipped: ignoring it would display a wrong optimum on some
5×5 boards.

## Decisions taken

| Decision | Chosen | Rationale |
| --- | --- | --- |
| What to reveal | The optimal press count always, the sequence on demand behind a toggle | The count is the lesson; the sequence is the detail for whoever wants it. |
| Where the sequence is shown | Both on the board as a highlight and as an ordered coordinate list | The highlight answers "where" instantly; the list is the accessible representation and carries the order. |
| Accessible equivalent | The ordered list, always complete on its own | The board overlay is visual reinforcement only, so a screen reader user loses nothing. |
| Kernel computation | Reduced row echelon form over GF(2), cached per size | Self-documenting and general, rather than a magic constant table. |
| Arithmetic | `BigInt` | A 7×7 board is 49 cells, and JavaScript bitwise operators truncate to 32 bits. This is the exact trap that already produced a silent bug in `solver.ts`; using `number` masks here would reintroduce it. |
| Scope | Client-side only | No contract change, no server work. |

## Tasks

- [x] **T1 — Optimal solution module.** `apps/web/src/game/optimal.ts` with the kernel basis and the
  coset minimum, plus tests that prove both properties against brute force.
- [x] **T2 — Reveal in the solved state.** Show the optimal count, a toggle for the sequence, the
  board highlight and the ordered coordinate list, with component tests.
- [x] **T3 — Documentation.** A section in `docs/architecture.md` and a line in the help dialog.
- [x] **T4 — Verification.** Independent verification.

## Evidence log

| Task | Commit | Evidence |
| --- | --- | --- |
| T1, T2 | this commit | Parent verification, independent of the writer's own tests: my own kernel computation agreed with the implementation on dimension and basis weights for all three sizes; 420 seeded scrambles across 3x3, 5x5 and 7x7 produced 0 invalid plans, 0 shape errors and 0 minimality failures; the writer's 7x7 example reproduced exactly once I used the project's own seeded generator, which proved the earlier apparent discrepancy was my different generator, not their code. 235 tests (98 API, 137 web). |
| T3 | this commit | `docs/architecture.md` gained the derivation, the kernel dimensions, the `BigInt` requirement and why the reveal belongs after the game rather than during it. The help dialog gained one sentence. |
| T4 | this commit | Verification was performed by the parent inline rather than delegated, because the correctness question was mathematical and I had already written the independent oracle while assessing viability. |

## Corrections applied by the parent

| Correction | Reason |
| --- | --- |
| Rewrote the 5x5 minimality test to cap the oracle instead of raising its timeout. | The writer ran four samples against an exponential oracle and added a 20 s timeout because the test took 15.7 s under coverage. That is 27% headroom, which fails on a slower machine. The oracle now runs only where it is cheap, with a guard asserting at least 8 cases were exercised so it cannot silently become vacuous. Duration fell to 1.6 s and the timeout is gone. |
| Replaced a literal DOM id in `SolutionReveal` with `useId()`. | A hardcoded id collides if the component is ever rendered twice, and a duplicate id silently breaks `aria-controls`. |

## Known limitations

- The reveal is only correct while the client knows how the board was generated. If the server ever
  issues puzzles, the derivation moves with it.
- The sequence is one optimal solution, not the only one. On 5×5 the kernel is non-trivial, so other
  equally short solutions exist; the game shows one.
- Press order within the sequence is arbitrary, because presses commute. It is presented ascending by
  cell index for readability, not because the order matters.
- The optimum is not submitted anywhere, so the leaderboard cannot use it. Making the score depend on
  efficiency would be a contract change and needs a decision.
