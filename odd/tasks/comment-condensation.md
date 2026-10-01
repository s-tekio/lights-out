# Comment condensation pass

Goal: condense explanatory comments across `apps/api/src`, `apps/api/test`, `apps/web/src`, `apps/web/test`, and `terraform` while keeping every rationale intact.

Rules:
- Only comment lines may change in the diff.
- No line of TypeScript, TSX, or HCL may change.
- Keep every reason (why, traps, external constraints, non-obvious facts).
- Remove or shrink prose that restates the code, explains general concepts, adds hypotheticals, hedges, or repeats ideas.

Tasks:
- [x] Establish baseline comment-line counts per area.
- [x] Read and condense comments in `apps/api/src`.
- [x] Read and condense comments in `apps/api/test`.
- [x] Read and condense comments in `apps/web/src`.
- [x] Read and condense comments in `apps/web/test`.
- [x] Read and condense comments in `terraform`.
- [x] Run mechanical diff check: only comment lines changed.
- [x] Run verification commands and capture coverage/test counts before and after.
- [x] Count comments after and select 15 load-bearing examples.

Outcome:
- Comment lines reduced from 549 to 475 across the five areas.
- Mechanical diff check: 0 non-comment lines changed.
- Verification commands passed before and after; coverage/test counts unchanged.
