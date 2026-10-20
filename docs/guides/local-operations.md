# Local Operations Guide

## Prerequisites

- Node.js 24 LTS
- pnpm 11
- PostgreSQL 18 (or a compatible PostgreSQL server)

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`. Provide a local `DATABASE_URL`, `APP_ORIGIN`, and `API_PORT`; keep `NEXT_PUBLIC_API_URL` pointed at the API. Never commit the local files.

With `NODE_ENV=development`, requesting password recovery prints the recipient, reset link, and 30-minute expiry in the API terminal; open that link to exercise the reset flow without SMTP credentials. The adapter sends no SMTP mail in this mode. Automated tests retain their silent in-memory capture. Other environments use the `SMTP_*` values in `apps/api/.env` and never log recovery links. Do not put real SMTP credentials or recovery links in example files or retained project documentation.

## Install, migrate, seed, and run

```text
pnpm install
pnpm --filter @smd/api prisma:generate
pnpm --filter @smd/api exec prisma migrate deploy
pnpm --filter @smd/api prisma:seed
pnpm dev
```

The API is available at `http://localhost:4000/api/v1`; the web app is available at `http://localhost:3000`.

For a local administrator, provide `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` only in the local environment while running the seed command.

Expired password-recovery records remain unusable without cleanup. The bounded maintenance commands `pnpm --filter @smd/api recovery:cleanup` and `pnpm --filter @smd/api session:cleanup` remove recovery tokens and stale sessions only after their 30-day retention windows; schedule them only as part of an approved deployment runbook.

For a repeatable local walkthrough, after an active Administrator or Marketing Officer account exists, run `pnpm --filter @smd/api demo:prepare`. It creates or refreshes the reserved `[Demo] Marketing Performance Walkthrough` campaign and deterministic September 2026 performance/target data. Do not run this demo command in production.

## Verification

```text
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm format:docs
```

## Backup and restore

Use PostgreSQL tooling against the application database/schema. Do not run restore commands against an unrelated database without verifying the target first.

```text
pg_dump --format=custom --file=backup.dump "$DATABASE_URL"
createdb restored_dashboard
pg_restore --dbname=restored_dashboard backup.dump
```

Before a production/demo migration, take a backup, run the approved Prisma migration, then verify `/api/v1/health` and an authenticated read. Backups are operational artifacts and must not be committed. Use the [isolated backup/restore verification](../evidence/backup-restore-verification.md) and the [deployment runbook](deployment-runbook.md) for release preparation.
