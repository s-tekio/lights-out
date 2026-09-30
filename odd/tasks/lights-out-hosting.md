# Feature: lights-out-hosting

**Status:** in progress
**Branch:** `feat/bootstrap`
**Created:** 2026-09-30
**Workflow:** ODD (Organic Driven Development)

## Goal

Serve the built React app from AWS so the game has a real URL over HTTPS, and make the deployed
frontend talk to the deployed API without any development flag.

## Why this closes the gap the user noticed

The frontend was only ever served by Vite on `localhost`. The deployed API Gateway serves JSON and
nothing else: its root returns API Gateway's own `{"message":"Not Found"}`, not HTML. So the browser
and the deployed stack were two separate worlds, and the only way to bridge them was the
`VITE_API_PROXY_TARGET` flag added for development.

CloudFront resolves it properly: the app and `/api/*` share one domain, so the browser's calls are
same-origin. No CORS, no flag, and the application does not have to know where it is talking to.

The assignment also requires the application deployed on AWS, so this is not optional.

## Decisions taken

| Decision | Chosen | Rationale |
| --- | --- | --- |
| S3 access from CloudFront | **Origin Access Control** | The current mechanism. Origin Access Identity is legacy. The bucket stays private with a policy scoped to the distribution. |
| Bucket name | `project-environment-web-<account id>` | S3 bucket names are global. The account id comes from a `data` source, so nothing is hardcoded, and the name cannot collide with another student's. |
| Custom domain and certificate | None | CloudFront's default domain already serves HTTPS with its own certificate, so there is no ACM certificate, no `us-east-1` provider alias and no Route 53 zone. Decided earlier and still holds. |
| `/api/*` origin path | None | The API Gateway stage is `$default`, so there is no stage prefix to strip. That was the point of naming it `$default` during slice 1a. |
| API behaviour caching | **Disabled** | A leaderboard must not be served stale, and POST and DELETE are not cacheable at all. |

## Gotchas that will break this if they are missed

These are the specific ways this configuration fails, each of which is cheap to get right and
expensive to diagnose:

- **`allowed_methods` on the `/api/*` behaviour must include `DELETE`.** The default set does not, so
  the purge would be rejected by CloudFront before reaching Lambda, with a 403 that looks like a
  permissions problem.
- **The cache policy must be Caching Disabled and the origin request policy must forward the query
  string.** Otherwise `?confirm=DELETE`, the sort parameters and the limit never reach the API, and
  everything silently behaves as if no parameters were sent.
- **No `origin_path` on the API origin**, because the `$default` stage already serves at the root.
- **The bucket object upload depends on a prior `npm run build`.** `fileset` over a missing directory
  yields an empty set rather than an error, which would deploy an empty site. A precondition must fail
  with an actionable message instead.
- **A new build must invalidate the cached `index.html`.** The hashed assets are safe, `index.html` is
  not, and a stale one points at assets that no longer exist.
- With OAC, S3 answers a missing object with 403 rather than 404. This app is a single page with no
  client-side routing, so only `/` and the hashed assets are ever requested and nothing needs an error
  document mapping. Recorded so it is not mistaken for a bug later.

## Tasks

- [ ] **T1 — Terraform.** The site bucket, origin access control, distribution with both behaviours,
  the bucket policy, the object upload, the invalidation and the outputs.
- [ ] **T2 — Documentation.** `docs/architecture.md` and the README: the deploy steps, the URL, and
  what teardown requires.
- [ ] **T3 — Verification.** Local: `fmt`, `validate` and a plan. Live, after the user applies: the app
  loads over HTTPS from the CloudFront URL, a game submitted from that page reaches DynamoDB, and the
  purge works from the UI.

## Known limitations to record

- The purge button becomes reachable by anyone who loads the deployed URL, which is the consequence of
  the unauthenticated purge decided earlier. Already documented; this makes it concrete.
- Old hashed assets accumulate in the bucket on every deploy because nothing removes them. Harmless at
  this scale and worth a note rather than a lifecycle rule nobody asked for.
