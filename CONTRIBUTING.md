# Contributing

This document describes the workflow for contributing to the Lights Out repository. The binding technical bar is defined in [`docs/engineering-standards.md`](docs/engineering-standards.md); every change must satisfy it.

## Branches

Create a feature branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feat/short-description
```

Use prefixes that describe intent:

- `feat/` — new behaviour or capability
- `fix/` — bug fix
- `refactor/` — behaviour-preserving structural change
- `docs/` — documentation-only change
- `chore/` — tooling, dependencies, or housekeeping
- `test/` — test-only change

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): subject

Body explains *why*, not only *what*.
```

Examples:

```text
feat(api): add board-size filter to leaderboard query
fix(router): return 400 instead of 500 on malformed JSON
chore(ci): add dependency audit step
```

**One commit is one reviewable work unit.** A commit must not mix unrelated refactors with behaviour changes, and it must keep tests and documentation next to the behaviour they describe. If a change is large enough to need several work units, split it into a chain of commits or stacked pull requests.

## Local verification

Run the full local verification sequence before opening a pull request:

```bash
npm install
npm run lint
npm run format:check
npm run typecheck
npm run test:coverage
npm run build
```

All commands must pass. The pre-commit hook runs `lint-staged`, which blocks commits that fail ESLint or Prettier checks on staged files.

## Pull requests

1. Push your branch to the remote.
2. Open a pull request against `main`.
3. Ensure the CI pipeline is green.
4. Request review from a maintainer.
5. Address feedback. Use fixup commits during review and squash them before merge.
6. Merge is performed on GitHub; `main` only receives merges.

## Review expectations

Reviewers verify the engineering-standards rules that are not fully automated, including architecture boundaries, error handling, test quality, and documentation completeness. [`docs/engineering-standards.md`](docs/engineering-standards.md) is the binding bar.
