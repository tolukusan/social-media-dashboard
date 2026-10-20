# Fresh Render database migration recovery

## Cause and fix

The first three committed migrations and several later migrations use unqualified PostgreSQL object names. The remaining migrations explicitly target `social_media_dashboard`. Prisma's `datasource.schemas` describes model placement but does not select the connection's default schema. A bare Render URL therefore applied the first migrations to `public`, then failed with P3018 / PostgreSQL 3F000 at `20261007100000_password_recovery_tokens`.

`prisma.config.ts` now normalizes an omitted URL `schema` parameter to `social_media_dashboard`, preserving other parameters and rejecting a conflicting explicit schema. Prisma creates the selected schema and uses it for migration tracking and unqualified SQL. No historical migration SQL/checksum changes are needed. Already migrated installations using the intended application schema continue using their existing migration journal.

## Recovery for this failed first deployment

1. Deploy the fix on `main` using the existing `prisma migrate deploy` start command.
2. With the reported failure (no application schema, first three migrations in `public`), the corrected configuration creates the application schema and its own migration journal, then applies all committed migrations there.
3. The old `public` tables and failed journal remain intact. This approach was verified against the exact locally reproduced partial failure. It does not reset the database, remove rows, move tables, or mark migrations as applied without executing them.
4. Verify all migrations finish, production seed completes, and `/api/v1/health` returns HTTP 200. Verify application login separately.
5. If the application schema already contains a failed migration or existing objects, stop and inspect that state; this recovery must not be generalized to a different partial installation. Do not blindly use `migrate resolve`.
6. Public remnants may be reviewed later. Before any deletion, confirm user/business tables contain no user data and obtain explicit approval. No deletion or reset is part of this fix.

An installation that previously kept real application data only in `public` requires a separately reviewed data relocation plan. The schema-normalization fix does not migrate those rows. Successfully migrated installations already using `social_media_dashboard` require no data relocation.

## Repeatable isolated verification

From the repository root, with local PostgreSQL 18 admin credentials available only in the ignored API environment:

```powershell
pnpm --filter @smd/api build
pnpm --filter @smd/api exec tsx scripts/verify-fresh-migrations.ts
```

The script refuses remote hosts and non-18 PostgreSQL versions. It creates a unique `smd_test_*` database without precreating an application schema; applies migrations using a bare URL; confirms no application tables landed in `public`; runs the production seed twice and verifies the existing admin password stays unchanged; repeats migration deploy; and starts the compiled API in production mode with the scheduler disabled, checking HTTP health. It retains its isolated database for inspection and never drops or resets any database.

## Verification evidence (2026-10-20)

- PostgreSQL 18.1: bare URL before fix reproduced the exact four-migration P3018 / 3F000 failure.
- Explicit application schema URL: all 16 existing migrations passed.
- Fixed configuration with bare URL and empty database: all 16 migrations passed, production seed and repeated seed passed, repeated migrate deploy passed, production API health returned HTTP 200.
- Fixed configuration against the locally reproduced failed database: all 16 application-schema migrations passed, public objects/journal preserved, public User table remained at zero rows.
- Render recovery is non-destructive; no reset command or schema/table deletion is authorized by this document.
