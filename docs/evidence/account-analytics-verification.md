# Connected-account analytics verification

Date: 2026-10-14. Status: AAN-01 implemented and verified locally. No live provider credentials or account access were used.

## Implemented behavior

- Added an account/content daily analytics store directly under `IntegrationConnection`, separate from campaign `PerformanceRecord` data.
- Added provider-specific, versioned metric definitions with source field, meaning, unit, aggregation strategy, scope, and optional retention days. The ingestion service rejects unknown/ambiguous metric definitions, invalid values, duplicate observations, and LinkedIn metrics without an explicit retention rule.
- Added an authenticated read endpoint at `GET /api/v1/integrations/:id/analytics`, with date and scope filters. The default scope is account-level; content queries are limited to 31 days. The result returns provider-specific raw values and metadata without calculating or mixing unlike metrics.
- Added idempotent ingestion/correction handling for account observations. Missing values remain absent; an observed zero remains zero. Campaign KPIs and PDF inputs remain in the existing campaign path.
- Added value-level connection provenance and expiry for campaign integration metrics. LinkedIn ad reporting values expire 364 days after retrieval, are hidden from analytics at expiry, and are removed by the API retention worker. Retention is defined per account metric so future content data can use shorter provider limits.
- Seeded account metric definitions for Facebook Ads, Instagram Ads, and LinkedIn Ads. Organic, YouTube, and OAuth provider implementations are still sequenced work, not claimed as integrated.

## Verification

| Check                                                                      | Result                                                                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm --filter @smd/api exec prisma format`                                | Passed                                                                                        |
| `pnpm db:generate`                                                         | Passed                                                                                        |
| `pnpm test:db:prepare`                                                     | Passed; confirmed the dedicated loopback PostgreSQL test database                             |
| `pnpm --filter @smd/api test:integration integrations.integration.test.ts` | Passed; 11 tests (rerun after final service edits)                                            |
| `pnpm test:unit`                                                           | Passed; 66 tests across 16 files                                                              |
| `pnpm test:integration`                                                    | Passed; 64 tests across seven files, 319.63 seconds                                           |
| `pnpm typecheck`                                                           | Passed for shared, API, and web workspaces; API typecheck rerun after final service edits     |
| `pnpm build`                                                               | Passed for shared, API, and web workspaces                                                    |
| `pnpm format:docs`                                                         | Passed                                                                                        |
| Changed-code Prettier check                                                | Passed                                                                                        |
| `git diff --check`                                                         | Passed                                                                                        |
| `pnpm lint`                                                                | Blocked only by existing formatting in untouched `apps/api/scripts/local-campaign-cleanup.ts` |

Migration `20261014090000_connected_account_analytics` was applied to the isolated test database. It adds provider/account analytics tables and provenance columns, then backfills only existing integration-managed campaign values. No local application database migration, reset, external request, or credential access was performed. No UI flow changed, so no browser E2E run was needed for this slice.

Integration coverage checks account/campaign separation, provider-specific metric labels, zero versus missing, idempotent repeats and corrections, daily filtering, all three roles' read access, unique keys, LinkedIn expiry, campaign dashboard exclusion after expiry, and provider-value cleanup.

## Remaining limitations

- Browser OAuth, secure token refresh/revocation, Facebook/Instagram organic analytics, LinkedIn Page analytics, YouTube channel/video adapters, Zoho account-level data, connected-account dashboard UI, automatic account-level sync, and redesigned PDFs are not part of AAN-01.
- Zoho's existing cumulative campaign snapshots remain outside daily account analytics until a verified period contract is implemented.
- Older LinkedIn-mapped campaign values that became unmanaged before this migration have no per-value source identity. They require a data audit before full retention compliance can be claimed; they are not automatically deleted. See [BLOCKERS](../../BLOCKERS.md).
- The retention worker requires the API process to run. It hides expired values on reads if the deletion sweep cannot complete. External deployment must keep the worker available and monitor its safe warning.
- Real API permissions, rate limits, source parity, and live account authorization remain unverified.

The full unit/integration suites and workspace build passed before the final small account-query refinements; after those refinements, the API typecheck and focused 11-case PostgreSQL integration suite were rerun and passed. The broad `pnpm lint` limitation remains the pre-existing formatting issue stated above.
