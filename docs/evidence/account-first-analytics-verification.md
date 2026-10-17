# Account-first connected analytics verification

Date: 2026-10-17. Status: implemented locally and verified with fixtures, isolated PostgreSQL/HTTP coverage, and browser journeys. Live provider approval and account access were not available for this run.

## Product flow delivered

The user journey starts in Accounts and does not require a campaign:

1. Connect Instagram, Facebook Pages, LinkedIn Pages, YouTube, or Zoho Campaigns through server-managed OAuth.
2. Discover eligible accounts and sync available provider metrics/content into connected-account storage.
3. View provider-specific audience, activity, change, content, or email campaign measures for a selected date range.
4. Compare two to four social accounts side by side, with each account's definitions, period change, and its own top-content list.
5. Download individual account PDF reports or the selected social-account comparison as CSV.

Social account metrics and Zoho email campaign reports are separate from campaign-linked paid analytics. Similar labels do not create cross-provider totals. Missing provider fields stay unavailable; reported zero values remain zero. Existing CSV import flows remain available as a fallback.

Disconnect attempts provider grant revocation for YouTube/Google and Zoho when configured and when the credential is not shared by another connected account. Meta Page credentials cannot revoke the app grant, and LinkedIn app-grant revocation is not implemented; those cases are reported to the user. Local account data is deleted and the revocation outcome is audit-recorded even when provider revocation is unsupported or fails.

## Data semantics and limits

- Provider metrics retain provider-specific codes, labels, and caveats. Comparison cells show the source label for that account; unsupported metrics are not converted to zero or aggregated across platforms.
- Each social account shows its own top-content ranking. Instagram, Facebook, and LinkedIn rankings are computed over up to 20 eligible synced items; YouTube returns up to 10 results from the provider's selected-range view. Report caveats explain these bounds and identify lifetime versus selected-period values. Comparison lists and CSV rows carry the same scope labels; lifetime CSV rows do not include the selected date range.
- Zoho campaign totals are cumulative snapshots selected by campaign sent date, not daily activity. Zoho supplies `open_percent` and `unique_clicked_percent`; open rate is based on unique opens per delivered email and unique click rate on unique clicks per delivered email. Summary rates are weighted by delivered count, and campaigns missing a rate or denominator are excluded. Missing totals remain unavailable.
- Provider syncs use bounded pagination and GET retries for transient failures. Repeating a whole account/date-range sync is safe through unique-key upserts; a failed multi-page sync restarts the range, because durable page-level cursors/checkpoints are not stored.
- Zoho scans up to 400 recent sent campaigns and fetches at most 400 campaign reports per run. Email report caveats explain that older matching campaigns may not be included. Provider historical windows, permissions, delayed data, post-metadata retention, and account eligibility remain provider-controlled.

The Zoho field names and API quota were checked against [Zoho Campaign Reports API documentation](https://www.zoho.com/campaigns/help/developers/campaign-reports.html). Rate definitions were checked against the [Zoho Reports and Analytics FAQ](https://help.zoho.com/portal/en/kb/campaigns/faqs/reports-and-analytics/articles/reports-and-analytics-faq-revamp).

## Changed implementation

- `apps/api/src/accounts/account-provider-client.ts`, `account-contract.ts`, and `account-report-pdf.ts`: bounded multi-page provider reads, transient GET retry handling, selected-range Zoho campaign reporting and native rate fields, provider revocation for Google/Zoho, and PDF percentage formatting.
- `apps/api/src/accounts/connected-accounts.service.ts`: delivered-weighted Zoho rate summaries, explicit unavailable values, existing snapshot/report aggregation, grant-sharing checks, and local disconnect/audit results.
- `apps/api/src/accounts/fixtures/` and account provider/service/integration tests: documented Zoho response keys, golden Instagram and LinkedIn responses, pagination, retry, revocation, rate, missing-versus-zero, and OAuth-to-database-to-report HTTP coverage.
- `apps/web/features/accounts/accounts.tsx` and `apps/web/app/globals.css`: comparison picker/table, per-account content lists with explicit measurement scope, CSV export, sync health, clear provider-rate labels, and disconnect outcome messaging.
- `e2e/accounts.spec.ts` and `apps/api/scripts/run-e2e.ts`: account workspace, permissions, comparison/CSV, email-rate display, sync-health assertions, and a longer API-startup allowance for cold TypeScript startup.
- `docs/product/account-first-connected-analytics.md`, ADR-011, `BLOCKERS.md`, the completion ledger, and this report: current product decision, evidence, verification, and remaining live-access limitations.

No schema migration or dependency change was required. The isolated test database reported seven existing migrations and no pending migration. No provider secret, account token, live network authorization, deployment, commit, or push was used.

## Verification results

| Command                               | Result                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                           | Passed for all workspace packages                                                                                                  |
| `pnpm typecheck`                      | Passed for shared, API, and web packages                                                                                           |
| `pnpm test:unit`                      | Passed: 95 tests in 20 files                                                                                                       |
| `pnpm test:integration`               | Passed: 64 PostgreSQL/HTTP tests in eight files against the isolated local test database, including OAuth-to-persisted-report flow |
| `pnpm test:e2e`                       | Passed: all 19 browser journeys, including explicit lifetime/selected-period comparison labels and matching CSV date scope         |
| `pnpm build`                          | Passed: shared, API, and Next.js production builds                                                                                 |
| Changed-code Prettier check           | Passed                                                                                                                             |
| `pnpm format:docs`                    | Passed after this report and ledger were updated                                                                                   |
| `git diff --check`; `git ls-files -u` | Passed; no whitespace errors or unresolved index conflicts                                                                         |

The browser E2E suite uses local API routes and fixtures/mocks; it does not claim live OAuth or provider data acceptance. Live acceptance requires operator-managed OAuth app credentials, provider scopes/app approval, eligible real accounts, and comparison of visible reports/PDFs with each provider.
