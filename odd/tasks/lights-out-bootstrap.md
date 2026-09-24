# Feature: lights-out-bootstrap

**Status:** in progress
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
- [ ] **T2 — Frontend scaffold.** Vite + React + TypeScript app in `apps/web`, with linting and
  a test setup.
- [ ] **T3 — Lights Out game.** Board model, move resolution, solved detection, move counter and
  timer, playable UI.
- [ ] **T4 — Ranking domain.** Score validation rules, ranking types, repository port and an
  in-memory adapter, with unit tests.
- [ ] **T5 — Ranking HTTP layer.** Lambda handlers for score submission and leaderboard read, plus
  a local development server that reuses the same handlers, with tests.
- [ ] **T6 — Wire frontend to backend.** API client, score submission on win, leaderboard view.
- [ ] **T7 — Documentation.** `README.md` (functional description, architecture decision,
  Mermaid diagram, cost estimate, deploy/destroy) and `docs/architecture.md`.
- [ ] **T8 — Verification.** Install, typecheck, test and build all green from a clean state.

## Non-goals (this feature)

- Terraform, AWS accounts, IAM roles, budgets, alarms.
- CI/CD pipeline.
- Real DynamoDB adapter (the in-memory adapter plus the repository port is the seam for it).
- Authentication and user accounts.
- Puzzle solvability guarantee at generation time.

## Evidence log

| Task | Commit | Evidence |
| --- | --- | --- |
| T1 | `2b1ac18` | `git log --oneline` shows the bootstrap commit on `feat/bootstrap`; `npm workspaces` declared in root `package.json`. |

## Next feature (not this one)

`lights-out-infra`: Terraform for S3 + CloudFront + API Gateway + Lambda + DynamoDB, the DynamoDB
repository adapter, GitHub Actions pipeline, CloudWatch alarms, AWS Budgets and resource tagging.
