# Deployment Runbook

This runbook describes a single-organisation deployment of the current Next.js web app, NestJS API, and PostgreSQL database. See the [current deployment handover](../../project-documentation/DEPLOYMENT.md) and [evidence status](../../project-documentation/STATUS.md) for recorded production addresses, repair history and verification boundaries. The runbook itself is a procedure, not proof of successful deployment.

## Required configuration

API environment:

- `NODE_ENV=production`
- `DATABASE_URL` for the application database
- `APP_ORIGIN` set to the exact HTTPS web origin
- `PORT` supplied by the platform; `API_PORT` is the local fallback
- `SESSION_COOKIE_NAME` when the default is not used
- `REPORTING_TIMEZONE`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` when self-service email recovery is enabled

Web environment (Render production):

- `NEXT_PUBLIC_API_URL=/api/v1`
- `SMD_API_ORIGIN` set to the HTTPS API origin only, without `/api/v1`; Next.js proxies browser requests from the web origin

Do not commit production values. Production `APP_ORIGIN` must use HTTPS. CORS and unsafe-request Origin validation use that exact origin.

## Before deployment

1. Confirm the target database and deployment environment.
2. Take a PostgreSQL backup and record its location outside the repository.
3. Run the release checks against an isolated test database:
   `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`, and `pnpm format:docs`.
4. Confirm `REPORTING_TIMEZONE` with the deploying organisation. After migration, an Administrator selects the reporting currency in the app's Settings screen; the legacy `REPORTING_CURRENCY` environment variable is ignored. Existing deployments should select their previous operational currency, since stored amounts are not converted.
5. If password-recovery email is required, verify the authorised SMTP provider and sender before exposing the recovery workflow to users.

## Database and application rollout

The Render API start command applies committed migrations before the server starts. A migration failure prevents startup:

```text
pnpm --filter @smd/api exec prisma migrate deploy && pnpm --filter @smd/api start:prod
```

Do not use `prisma migrate reset` or destructive reset commands against an existing environment. The catalogue seed may be run when the deployment process explicitly requires the deterministic fixed catalogue. Do not run the demo-data command in production.

Start the API and web processes using the deployment platform's normal process manager. The API health endpoint is `/api/v1/health`.

For field-by-field Render configuration, first-admin initialization, safe existing-database restoration, and same-origin OAuth URLs, follow the [Render deployment guide](render-deployment.md). It is the current platform-specific procedure.

## Post-deployment smoke

Verify:

1. health returns 200
2. the web application loads over HTTPS
3. Administrator, Marketing Officer, and Management accounts can authenticate
4. Management remains read-only
5. an authenticated dashboard read succeeds
6. report preview and PDF download require authentication
7. an unsafe request from a non-approved Origin is rejected
8. password recovery sends to an authorised test inbox when SMTP is enabled

Never include passwords, session tokens, recovery tokens, or SMTP credentials in retained evidence.

## Scheduled maintenance

Run these bounded cleanup commands on a deployment-approved schedule:

```text
pnpm --filter @smd/api session:cleanup
pnpm --filter @smd/api recovery:cleanup
```

They remove only stale session records and recovery tokens beyond their documented retention windows.

### Connected-account analytics and Meta history jobs

The connected-account worker and retention sweep run inside the API process. Keep an API process continuously running and set `INTEGRATIONS_SCHEDULER_ENABLED=true` explicitly for daily refresh and queued Meta history jobs. False disables even manually requested Meta jobs; the old false-plus-manual advice is superseded by the [Render sync repair](../evidence/render-account-sync-repairs.md). The separate canonical retention sweep does not depend on this flag, but all process timers depend on API uptime. A sleeping/stopped API cannot promise daily collection. Meta jobs use PostgreSQL leases and a one-active-job-per-account constraint; non-Meta account sync/refresh still uses process-local exclusion, so review coordination before adding API instances.

For a release that adds Meta annual history, take a verified PostgreSQL backup first, then deploy the additive migration before starting the API version that claims sync jobs:

```text
pnpm --filter @smd/api prisma:generate
pnpm --filter @smd/api exec prisma migrate deploy
```

The migration adds sync-job/chunk tables and changes only eligible, still-unexpired Instagram/Facebook account metric expiries to their stored retrieval timestamp plus 365 days. It leaves expired values expired and does not change 90-day post snapshots, LinkedIn values, campaign imports, or other providers. Do not reset the database or rerun the full seed to apply this release.

After deployment, verify one bounded job for each connected Meta provider in a controlled account, then check job completion/partial status, per-metric coverage, and `latestSuccessfulHistoryFetchAt`. Instagram requests are clipped to the latest 90 days; Facebook uses up to 365 days for this app's annual backfill. Reports may remain partial when a metric or date is unavailable. Sync-job status contains no credentials or raw provider payloads and is retained for 30 days after completion.

## Backup and restore

Create backups with PostgreSQL tooling and restore only to a target whose identity has been verified. Use the isolated procedure in [backup/restore verification](../evidence/backup-restore-verification.md) before relying on the procedure for a live environment.

## Rollback

If an application release fails, roll back the application version first. Do not reverse an applied migration by deleting tables or data ad hoc. The current password-recovery migration is additive and may remain present while the feature is disabled. Restore from backup only when a database-level rollback is actually necessary and the restore target has been verified.

## Current deployment status

The original preparation task did not deploy. Later repair evidence and the current public routing checks are documented in [STATUS](../../project-documentation/STATUS.md); authenticated provider, SMTP and recovery acceptance remain separately identified there. Do not treat an old preparation-only statement as a claim that no public deployment exists today.

## Usability/archive/access migrations (2026-10-18)

Back up the application schema using the existing backup procedure, deploy the API/web code together, generate Prisma, and apply committed migrations with `pnpm --filter @smd/api exec prisma migrate deploy`. Never reset the database or rerun demo seeds to deploy this feature.

- `20261018070000_archive_timestamps` fills only missing archived-record timestamps backed by existing matching archive audit events. Unverifiable dates remain null.
- `20261018071000_archive_deletion` adds actor-bound confirmation storage and persistent deleted daily-key tombstones. It deletes no application records during deployment.
- `20261018072000_registration_approval` adds registration requests, invitation hashes, and status/role constraints. It inserts only missing fixed role codes; existing role IDs, users, seeded Administrators, and historical data remain intact.

No provider scope, OAuth credential migration, external mail, or organization bootstrap is required. Keep invitation links and confirmation references out of logs. For multiple API processes, configure shared ingress limits equivalent to the public per-process IP/email limits. Campaign lifecycle writes are serialized by one PostgreSQL transaction advisory lock; monitor latency before increasing ingestion concurrency. Take a backup before intentional permanent deletion; retained import provenance and tombstones are not an undo facility.

For the detailed developer-app, OAuth, and new-system setup checklist, see [Provider setup and migration](provider-setup-and-migration.md).
