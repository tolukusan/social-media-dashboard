# Deployment Runbook

This runbook describes a single-organisation deployment of the current Next.js web app, NestJS API, and PostgreSQL database. It does not record a deployment as completed.

## Required configuration

API environment:

- `NODE_ENV=production`
- `DATABASE_URL` for the application database
- `APP_ORIGIN` set to the exact HTTPS web origin
- `API_PORT`
- `SESSION_COOKIE_NAME` when the default is not used
- `REPORTING_TIMEZONE`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` when self-service email recovery is enabled

Web environment:

- `NEXT_PUBLIC_API_URL` set to the public API URL ending in `/api/v1`

Do not commit production values. Production `APP_ORIGIN` must use HTTPS. CORS and unsafe-request Origin validation use that exact origin.

## Before deployment

1. Confirm the target database and deployment environment.
2. Take a PostgreSQL backup and record its location outside the repository.
3. Run the release checks against an isolated test database:
   `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`, and `pnpm format:docs`.
4. Confirm `REPORTING_TIMEZONE` with the deploying organisation. After migration, an Administrator selects the reporting currency in the app's Settings screen; the legacy `REPORTING_CURRENCY` environment variable is ignored. Existing deployments should select their previous operational currency, since stored amounts are not converted.
5. If password-recovery email is required, verify the authorised SMTP provider and sender before exposing the recovery workflow to users.

## Database and application rollout

Run database migrations before starting the new API version:

```text
pnpm --filter @smd/api prisma:generate
pnpm --filter @smd/api exec prisma migrate deploy
pnpm build
```

Do not use `prisma migrate reset` or destructive reset commands against an existing environment. The catalogue seed may be run when the deployment process explicitly requires the deterministic fixed catalogue. Do not run the demo-data command in production.

Start the API and web processes using the deployment platform's normal process manager. The API health endpoint is `/api/v1/health`.

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

## Backup and restore

Create backups with PostgreSQL tooling and restore only to a target whose identity has been verified. Use the isolated procedure in [backup/restore verification](../evidence/backup-restore-verification.md) before relying on the procedure for a live environment.

## Rollback

If an application release fails, roll back the application version first. Do not reverse an applied migration by deleting tables or data ad hoc. The current password-recovery migration is additive and may remain present while the feature is disabled. Restore from backup only when a database-level rollback is actually necessary and the restore target has been verified.

## Current deployment status

No external environment is recorded as deployed by this repository task. M12 remains dependent on an authorised external environment.

## Usability/archive/access migrations (2026-10-18)

Back up the application schema using the existing backup procedure, deploy the API/web code together, generate Prisma, and apply committed migrations with `pnpm --filter @smd/api exec prisma migrate deploy`. Never reset the database or rerun demo seeds to deploy this feature.

- `20261018070000_archive_timestamps` fills only missing archived-record timestamps backed by existing matching archive audit events. Unverifiable dates remain null.
- `20261018071000_archive_deletion` adds actor-bound confirmation storage and persistent deleted daily-key tombstones. It deletes no application records during deployment.
- `20261018072000_registration_approval` adds registration requests, invitation hashes, and status/role constraints. It inserts only missing fixed role codes; existing role IDs, users, seeded Administrators, and historical data remain intact.

No provider scope, OAuth credential migration, external mail, or organization bootstrap is required. Keep invitation links and confirmation references out of logs. For multiple API processes, configure shared ingress limits equivalent to the public per-process IP/email limits. Campaign lifecycle writes are serialized by one PostgreSQL transaction advisory lock; monitor latency before increasing ingestion concurrency. Take a backup before intentional permanent deletion; retained import provenance and tombstones are not an undo facility.
