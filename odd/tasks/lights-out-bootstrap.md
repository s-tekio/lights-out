# Feature: lights-out-bootstrap

**Status:** complete
**Branch:** `feat/bootstrap`
**Created:** 2026-09-24
**Workflow:** ODD (Organic Driven Development)

## Goal

Initialize the deliverable repository for the final project: a **Lights Out** game with a
persistent score leaderboard, structured so it can be deployed to AWS on a fully serverless
architecture.

This stage produces a working local project (game playable, leaderboard reachable over HTTP)
plus the documentation skeleton the assignment requires. Infrastructure as code, CI/CD and the
real AWS deployment are explicitly **out of scope** here and tracked as the next feature.

## Context

- Source assignment: `cloud_aws_enunciados-proyecto-final/enunciado_1_plataforma_social.md`
  (outside this repository — course material).
- The assignment's proposed product (a dev.to-style content platform) was replaced by the user
  with **Lights Out**. The common requirements (Terraform, AWS, HA, backups, CI/CD, security,
  observability, FinOps) still apply unchanged.
- Product profile is **the opposite** of the original assignment's "read-heavy, write-light"
  premise: Lights Out is a spiky-traffic game with small score writes and frequent leaderboard
  reads. The architecture decision must be argued against *this* profile.

## Decisions taken

| Decision | Chosen | Rejected | Rationale |
| --- | --- | --- | --- |
| Deployment architecture | Serverless: S3 + CloudFront, API Gateway + Lambda, DynamoDB on-demand | EC2 + ALB + RDS; ECS Fargate + RDS | Spiky, low-volume traffic. HA across 3 AZs for free, PITR backups via one flag, near-zero idle cost. EC2 + RDS Multi-AZ + NAT Gateway would cost ~$60-90/month at idle for capacity the game never needs. |
| Backend language | TypeScript on Node.js | Python + FastAPI | One language and one toolchain across frontend and backend; the same domain code runs in Lambda and in the local dev server. |
| Repository root | `project/` | `commit-academy/` | The public deliverable must not contain course material (assignment text, archives). |
| Package manager | npm workspaces | pnpm / yarn | Only npm is installed in the environment; workspaces avoid a second lockfile per app. |
| Test runner | Vitest | `node:test`, Jest | Shares configuration with Vite, works for both browser and Node packages with one toolchain. |

## Tasks

- [x] **T1 — Repository bootstrap.** `git init`, root `package.json` with npm workspaces,
  `.gitignore`, `.nvmrc`, `.editorconfig`.
- [x] **T2 — Ranking domain.** Score validation rules, scoring formula, repository port and an
  in-memory adapter, with unit tests.
- [x] **T3 — Ranking HTTP layer.** Framework-agnostic router shared by the Lambda handler and a
  local development server, with tests.
- [x] **T4 — Engineering standards.** Author `docs/engineering-standards.md`: the normative,
  ID-tagged rules for source control, TypeScript, architecture, testing, security, observability,
  FinOps, Terraform and documentation, each with its enforcement mechanism.
- [x] **T5 — Lint and format enforcement.** Root ESLint flat config with type-aware rules,
  Prettier check, and pre-commit hooks (husky + lint-staged).
- [x] **T6 — CI pipeline and coverage gate.** GitHub Actions running lint, typecheck, test with
  coverage thresholds, build, secret scanning and dependency audit; Dependabot configuration.
- [x] **T7 — Repository governance docs.** `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`.
- [x] **T8 — Frontend scaffold.** Vite + React + TypeScript app in `apps/web`, conforming to the
  standards enforced by T5 and T6.
- [x] **T9 — Lights Out game.** Board model, move resolution, solved detection, move counter and
  timer, playable UI.
- [x] **T10 — Wire frontend to backend.** API client, score submission on win, leaderboard view.
- [x] **T11 — Documentation.** `README.md` (functional description, architecture decision,
  Mermaid diagram, cost estimate, deploy/destroy) and `docs/architecture.md`.
- [x] **T12 — Verification.** Install, lint, typecheck, test and build all green from a clean state.

## Non-goals (this feature)

- Terraform, AWS accounts, IAM roles, budgets, alarms.
- CI/CD pipeline.
- Real DynamoDB adapter (the in-memory adapter plus the repository port is the seam for it).
- Authentication and user accounts.
- Puzzle solvability guarantee at generation time.

## Evidence log

| Task | Commit | Evidence |
| --- | --- | --- |
| T1 | `2b1ac18` | `git log --oneline` shows the bootstrap commit on `feat/bootstrap`; npm workspaces declared in root `package.json`. |
| Contract | `f5460f9` | `docs/api-contract.md` frozen before either application was written. |
| T2, T3 | `d767f9b` | 67 tests pass; `npm run typecheck`, `npm run test` and `npm run build` green for `@lights-out/api`. Parent smoke test confirmed `201` with `points: 2290`, `400` with field details, `404`, `405`. |
| T2, T3 fix | `d767f9b` | Parent review found three defects the writer's smoke test missed: `npm run dev` needed a prior build, `OPTIONS` returned `405` while being advertised, and expected `400`s logged stack traces. All three fixed and re-verified by the parent. |
| T4 | `96faf8f` | `docs/engineering-standards.md` with ID-tagged rules and enforcement column. |
| T5, T6, T7 | `44b55ed`, `c7e2de5` | `npm run lint`, `format:check`, `typecheck`, `test:coverage` (87% statements / 92% branches / 100% functions) and `build` all green. Pre-commit hook observed blocking a staged lint error. |
| T8, T9 | `0ab8725`, `fee31f0` | 96 tests total (67 API, 29 web). Web coverage 94.9% statements / 96.4% branches. Parent smoke test: `GET localhost:5173/` returned 200 and `GET localhost:5173/api/health` returned the API payload through the Vite proxy. |
| T10 | `888d7a5` | 124 tests total (67 API, 57 web). Parent verified: no casts on response bodies, `points` never appears in the submission payload, `role="alert"` on both error messages, `disabled={submitting}` on the submit control. |
| T11 | `669602a` | `README.md` and `docs/architecture.md`. Deployment and teardown sections state explicitly that infrastructure is not implemented, per DOC-3. |
| T12 | bookkeeping (no code) | Independent verification from a clean state by `gentle-ai-verify`: `npm ci` plus all six gates green after deleting `node_modules`, `dist/` and `coverage/`. 124 tests. Contract conformance verified endpoint by endpoint, including hand-checked points and ordering across ties. Standards rules TS-1, TS-2, TS-3, SEC-1, SEC-8, OB-2, TE-1, SC-2 and DOC-3 all verified. |

## Scope violations caught in review

| Task | Violation | Resolution |
| --- | --- | --- |
| T5–T7 | The writer ran `prettier --write` over the whole repository, reformatting `docs/api-contract.md`, `docs/engineering-standards.md` and `odd/tasks/lights-out-bootstrap.md`, which were outside its allowed edit surfaces. It also ticked task checkboxes in `odd/`, which the parent owns. | All three files reverted. Root cause fixed: Markdown is now excluded from Prettier, because table padding rewrites every row of a table when one cell changes. |
| T5–T7 | The writer invented the contact address `security@tekio.dev` in `SECURITY.md`. | Replaced with GitHub private vulnerability reporting plus an explicit note that the repository path must be filled in. A fabricated contact address is worse than none: reports would silently go nowhere. |
| T8, T9 | The writer left the whole Vite template scaffolding on disk (`App.css`, `index.css`, `assets/`, `public/`, `.oxlintrc.json`, `tsconfig.app.json`, `tsconfig.node.json`, a stub `README.md` and a duplicate `.gitignore`) stating that file deletions were avoided. It also installed two Vite majors and hid the resulting type conflict behind `react() as unknown as Plugin`, kept an unused `@testing-library/user-event` dependency, used `role="grid"` on a `div` of buttons (invalid ARIA), and cast a DOM value with `as DifficultyId`. | All six corrected in one review round and re-verified by the parent: a single Vite major (7.3.6), no cast, `role="group"`, a checked `isDifficultyId` guard, dead files deleted, unused dependencies removed. |
| T12 | Independent verification found the cost estimate contradicted itself: the stated assumptions implied ~10 500 API requests while the table used ~15 000, and the total's upper bound was not derived from any assumption. It also found the README claimed `infra/` was empty when the directory does not exist. | Both corrected. The request counts are now consistent and the total is stated at the assumptions with the ten-times-traffic figure explained separately. |

## Next feature (not this one)

`lights-out-infra`: Terraform for S3 + CloudFront + API Gateway + Lambda + DynamoDB, the DynamoDB
repository adapter, GitHub Actions pipeline, CloudWatch alarms, AWS Budgets and resource tagging.
