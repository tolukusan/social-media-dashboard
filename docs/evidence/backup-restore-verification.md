# Backup and Restore Verification

Status: automated local PostgreSQL 18 restore verification passed on 2026-10-07. Production recovery and target-environment review remain separate.

## Reproducible isolated verification

After `pnpm test:db:prepare` and `pnpm test:integration`, run `pnpm --filter @smd/api test:restore`. The command validates the loopback `smd_test_<random>` source, requires PostgreSQL 18, creates two campaigns/60 daily records/120 raw metric values and a temporary account, and exports with matching PostgreSQL tools.

It creates a unique `smd_restore_<random>` database; no existing destination is dropped. After restore, it compares ordered content fingerprints and counts for every application table, starts a temporary API, authenticates the restored account, and verifies campaign and filtered analytics reads. It applies no migration or seed to the restored destination. Finally it removes only its restore database, dump, API process and source fixtures.

The non-sensitive runtime record is `performance/runtime/restore-evidence.json`; CI retains it as a verification-summary artifact. The local run completed all checks and cleanup successfully; curated values are recorded in the [review follow-up evidence](review-follow-up-verification.md). Runtime dumps, credentials and connection strings must not be committed or uploaded.

## Safety boundary

Never test restore against the development or production database. Verify the source and destination database names before every command. Backups and restored databases are runtime artifacts and must not be committed.

## Verification procedure

1. Export the application database:

```text
pg_dump --format=custom --file=smd-backup.dump "$DATABASE_URL"
```

2. Create a new isolated database, for example `smd_restore_<unique>`.
3. Restore the dump into that isolated target:

```text
createdb smd_restore_<unique>
pg_restore --exit-on-error --dbname=postgresql://.../smd_restore_<unique> smd-backup.dump
```

4. Point a temporary API process at the restored database and verify:
   - `/api/v1/health`
   - roles, channels, and platforms exist
   - an existing authenticated read succeeds
   - campaign/performance counts match the source
   - no migration or seed reset was required
5. Delete only the isolated restore database after evidence has been recorded.

## Evidence record

Record the following when the procedure is actually executed:

- execution date
- source environment class, without credentials
- backup file size/checksum
- isolated restore database name
- restore exit status
- source/restored campaign count
- source/restored performance-record count
- health/read smoke result
- operator/reviewer
- cleanup result

The manual procedure is supplementary guidance; production restore success is not inferred from the isolated local result.
