# Local Operations Guide

## Prerequisites

- Node.js 24 LTS
- pnpm 11
- PostgreSQL 18 (or a compatible PostgreSQL server)

Copy `.env.example` to `.env` and provide a local `DATABASE_URL`, `APP_ORIGIN`, and `API_PORT`. Never commit the local file.

## Install, migrate, seed, and run

```text
pnpm install
pnpm --filter @smd/api prisma:generate
pnpm --filter @smd/api prisma:migrate
pnpm --filter @smd/api prisma:seed
pnpm dev
```

The API is available at `http://localhost:4000/api/v1`; the web app is available at `http://localhost:3000`.

For a local administrator, provide `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` only in the local environment while running the seed command.

## Verification

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Backup and restore

Use PostgreSQL tooling against the application database/schema. Do not run restore commands against an unrelated database without verifying the target first.

```text
pg_dump --format=custom --file=backup.dump "$DATABASE_URL"
createdb restored_dashboard
pg_restore --dbname=restored_dashboard backup.dump
```

Before a production/demo migration, take a backup, run the approved Prisma migration, then verify `/api/v1/health` and an authenticated read. Backups are operational artifacts and must not be committed.
