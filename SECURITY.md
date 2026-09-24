# Security

## Reporting a vulnerability

If you discover a security issue, please report it privately instead of opening a public issue or pull request.

Use GitHub's private vulnerability reporting on this repository:
**Security** tab → **Report a vulnerability** (or `https://github.com/OWNER/REPOSITORY/security/advisories/new`).

> **Repository owner:** replace `OWNER/REPOSITORY` above with the real path once this repository is
> published. No email address is listed on purpose: a fabricated contact address is worse than
> none, because reports would silently go nowhere.

Include:

- A clear description of the issue.
- Steps to reproduce it, or a minimal proof of concept.
- The affected files, routes, or components.
- The expected impact.

Do **not** include secrets, credentials, tokens, account IDs, or any sensitive data in the report. We will acknowledge receipt within 72 hours and keep you informed of our progress.

## Scope

The following are in scope for vulnerability reports:

- The `apps/api` HTTP router and Lambda handler.
- The local development server (`apps/api/src/local-server.ts`).
- Infrastructure as code and deployment automation under future `infra/` paths.
- CI/CD secrets handling and repository configuration.

Out of scope:

- Social engineering or physical security.
- Third-party services unless the vulnerability is directly caused by our configuration.

## Important project constraints

- **No secrets in issues.** Never post API keys, passwords, tokens, account IDs, ARNs, or private keys in a GitHub issue, pull request, or comment. If you accidentally include sensitive data, delete it immediately and report it through the private channel above.
- **No authentication.** This project currently has no user authentication or authorization. Player names are self-declared and unverified, and the leaderboard cannot prevent score submission under an arbitrary name. Do not report the absence of authentication as a vulnerability; it is a documented limitation tracked as future work.
