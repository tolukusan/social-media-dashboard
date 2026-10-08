# Application configuration verification — 2026-10-08

Scope: the stakeholder-authorised [application configuration follow-up](../plans/completion/app-configuration.md). These results apply to local working-tree changes after `c226073`, not to the previous PR's CI runs.

## Implemented behavior

- Administrator Settings contains an organisation-wide reporting currency selector. The backend validates supported uppercase currency codes, requires Administrator for updates, applies session/Origin/CSRF guards, and records changed codes in an atomic audit transaction.
- The dedicated singleton `ReportingSettings` table stores the code. Dashboard/report currency comes from PostgreSQL; the legacy environment variable is ignored. Initially unset remains null. Changing labels does not convert raw metrics, campaign budgets, or KPI targets.
- Explicit `NODE_ENV=development` logs the recovery recipient, reset URL, and expiry instead of sending SMTP. Production/staging/unspecified modes never log the message; production still uses SMTP. Test capture stays silent. The local API example includes development mode and removes the currency environment entry.
- `TODO.md` has no outstanding implementation tasks. Import provenance remains a documentation question in `BLOCKERS.md`. SMTP inbox delivery, currency selection, human review, participant testing, and external deployment are optional or conditional [release activities](../guides/release-checklist.md).
- Remaining stale root `.env.example` statements were corrected: `b5dc0ac` is on remote `main` through `f3d63ac`; those post-merge commits did not trigger CI.

## Commands and results

| Command                                  | Result                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @smd/api prisma:generate` | Passed; generated client includes ReportingSettings.                                                                    |
| `pnpm lint`                              | Passed for all workspace packages.                                                                                      |
| `pnpm typecheck`                         | Passed for all workspace packages.                                                                                      |
| `pnpm test:unit`                         | Passed: 48 tests in 14 files. Six delivery-mode tests added.                                                            |
| `pnpm test:integration`                  | Passed: 41 tests in four files. Six reporting-settings cases and one development recovery HTTP case added.              |
| `pnpm build`                             | Passed: shared, API, and production Next.js builds.                                                                     |
| `pnpm --filter @smd/api test:e2e`        | Passed: all seven journeys, including currency save/reload in the existing Settings journey. Temporary servers stopped. |
| `pnpm format:docs`                       | Passed.                                                                                                                 |
| `git diff --check`                       | Passed.                                                                                                                 |

An inline read-only checker also verified relative link targets in changed Markdown files. The first development recovery integration attempt incorrectly expected HTTP 201; the test was corrected to the existing HTTP 202 request / 200 reset contract and the entire suite then passed. Non-failing PostgreSQL client concurrency deprecation notices remain visible in existing test runs.

## Migration and limits

Created `20261008050000_reporting_settings`, an additive migration with singleton and uppercase-three-character format constraints. It was applied successfully to the existing dedicated local test database; constraint rejection cases passed. Existing tables, analytical data, and cardinalities are unchanged. Integration fixtures restored prior test settings, and the browser test saved NGN only in the isolated test database.

The application database still needs the normal migration rollout before running this version. Existing deployments should select their previous operational currency in Settings; no environment value is copied automatically. Backups enumerate tables dynamically and include the new table. Older application code can leave the additive table in place without a destructive rollback.

No new remote CI run, SMTP inbox delivery, human evaluation, or external deployment is claimed. Historical verification remains in [review follow-up evidence](review-follow-up-verification.md).
