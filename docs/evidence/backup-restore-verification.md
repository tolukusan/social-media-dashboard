# Backup and Restore Verification

Status: procedure prepared; execution evidence must be recorded from an isolated PostgreSQL environment.

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

No successful restore execution is claimed by this document alone.
