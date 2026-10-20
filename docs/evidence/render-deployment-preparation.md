# Render deployment preparation — 2026-10-20

## Scope and result

Prepared the `staging` codebase for Render's Node Web Services without creating a Render resource or deploying the application. The changes are on `work/render-deployment-20261020`; the `main` branch was not modified.

The [Render deployment guide](../guides/render-deployment.md) documents the two-service plus PostgreSQL setup from the Render dashboard, environment variables, first-Administrator initialization, fresh-database versus restore paths, same-origin OAuth callback URLs, smoke checks, Free-tier limitations, and official references.

## Implementation

- `apps/api/src/server-config.ts` reads the platform `PORT` first, then local `API_PORT`, then defaults to `4000`; it rejects invalid ports. `apps/api/src/main.ts` uses that setting and binds to `0.0.0.0`.
- `apps/web/next.config.ts` installs a production-only rewrite from `/api/v1/*` to the server-only `SMD_API_ORIGIN`. It requires an HTTPS origin in production and rejects paths, credentials, query strings, and fragments. HTTP loopback is permitted only when the isolated production-build E2E runner explicitly opts in; that flag must not be set on Render. Local development keeps its existing direct API URL.
- The API's `start:prod` script launches the compiled `dist/src/main.js` through `tsx`. TypeScript's bundler-oriented compilation preserves extensionless ESM imports, including in the generated Prisma client; directly starting that output with plain `node` fails module resolution. The existing `tsx` package is now a production dependency.
- `apps/api/prisma/seed.ts` keeps the development upsert behavior. In production it can create the first Administrator on a fresh database but skips administrator mutation when one already exists. Supplying only one of the two first-admin variables fails explicitly. Catalogue initialization remains deterministic.
- E2E browser requests use the frontend origin and exercise the production Next.js proxy, session/CSRF behavior, logout, and OAuth callback forwarding.
- Updated `.env.example`, deployment/provider runbooks, documentation index, implementation progress, and the completion ledger. No API schema migration or new package was added.

## Verification performed

Repository checks ran on 2026-10-20 from the repository root; the isolated compiled-API runtime smoke ran from the API package directory. Database-backed tests use the dedicated local `smd_test_…` database prepared by the repository runner, not the development database.

| Check                                                                               | Result                                  |
| ----------------------------------------------------------------------------------- | --------------------------------------- |
| `pnpm install --frozen-lockfile`                                                    | Passed                                  |
| Focused API policy tests (`server-config`, `seed-admin-policy`, `web-proxy-config`) | 3 files, 15 tests passed                |
| `pnpm lint`                                                                         | Passed                                  |
| `pnpm typecheck`                                                                    | Passed                                  |
| `pnpm test:unit`                                                                    | 32 files, 143 tests passed              |
| API Prisma generation and production build                                          | Passed                                  |
| Web production build with `/api/v1` and a non-secret placeholder API origin         | Passed                                  |
| Compiled API runtime smoke on Node 24.20.0 with isolated test database              | `/api/v1/health` returned HTTP 200      |
| `pnpm format:docs`                                                                  | Passed after final guide/evidence edits |
| Focused `pnpm --filter @smd/api test:e2e render-proxy.spec.ts`                      | 1 browser test passed                   |
| `pnpm test:integration`                                                             | 11 files, 84 tests passed               |
| `pnpm test:e2e`                                                                     | 25 browser tests passed                 |

The production browser runner built the web app and started isolated local web/API processes, then stopped only those temporary processes. It verified the browser used the web origin for API calls, the session cookie was `HttpOnly`/`SameSite=Lax`, invalid CSRF was rejected, login state survived reload, logout cleared access, and the callback route reached the API through the proxy.

Render platform behavior in the guide was checked against current official docs for [web-service port binding](https://render.com/docs/web-services), [Node versions](https://render.com/docs/node-version), [Free-tier limits](https://render.com/docs/free), and [monorepo root directories](https://render.com/docs/monorepo-support).

## Not verified or changed

- No Render service, PostgreSQL database, custom domain, or deployment was created.
- No provider developer-console setting, OAuth consent, credential, or production database was changed.
- No live SMTP delivery, database backup/restore, or production sign-in was performed.
- Free Render Postgres is temporary (30 days) and has no managed backups; Free Web Services sleep and cannot send SMTP on ports 25, 465, or 587. The guide marks those limits explicitly.
- The normal staging push and post-push remote verification are reported in the task completion message.
