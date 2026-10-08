# Guided UX execution and verification

Date: 2026-10-08. Scope: stakeholder-authorised local implementation of [UX-01–UX-04](../plans/completion/simple-ux-proposal.md). Local implementation and automated verification completed.

## Implemented behaviour

- One active import step: Upload file, Confirm details, Review and import, View results. Next stages/checks data; Import data explicitly commits it. Back and inline campaign creation retain draft state. Optional mapping/naming and history are secondary controls.
- Exact unique campaign matches, explicit source/platform hints, and deterministic previous mapping suggestions are preselected for review. Ambiguous platform/metric/campaign choices remain explicit. New campaigns receive an editable earliest-source-date suggestion.
- Worksheet changes replace the worksheet-specific columns, source identity, campaign values, date hints, and suggestions. Empty sheets are omitted. Previous template keys are adapted to current header identity without changing stored raw data.
- Review distinguishes source rows from canonical daily records, explains unchanged merge records, groups rejected/conflicting issues, and requires acknowledgement before a partial import. Existing-date conflicts can offer the existing missing-metric merge action; it still requires a fresh server check.
- Backend review and confirmation return accepted campaign/platform/date scopes. Separate links keep multiple campaigns distinct. Results include pre-existing records in the same scope. Dashboard/report calculations, zero/missing semantics, targets, backend RBAC, CSRF, archival keys, duplicate protection, and transactional writes remain authoritative.
- Overview offers a clear starting action, optional manual entry, and direct PDF export. Campaigns link into their import context. The common sidebar groups Data, Results, and Administration. Management receives a read-only journey. Advanced filters are collapsed with active-filter indicators and visible platform/metric scope.
- Date defaults cover available active records. Dashboard/analytics/report display defaults choose an available metric from backend metadata and values, preserving explicit unavailable selections and numeric zero. Results remain visible during filter refetch. Shared metadata is cached per user under a separate key and explicitly expired before workspace mutation refreshes, preventing stale catalogue reuse.
- No migration, schema change, dependency upgrade, external deployment, or application-data cleanup was performed. All automated writes used the existing isolated local test database.

## Added and updated tests

Two unit cases cover canonical-record summaries, merged source-row exclusion, explicit zero, unchanged records, empty input, and separate campaign/platform scopes.

Five PostgreSQL integration cases cover accepted-only dates and aggregation, zero/missing values, dashboard/report parity, merge/no-op/conflict behaviour, append/archived-key protection, independent worksheets/multiple campaigns, and previous-template header identity/raw preservation. Existing calculation and authorization tests also ran.

Four additional browser journeys cover a real four-primary-click import through scoped results and PDF; worksheet changes/partial acknowledgement/separate campaign links; ambiguous platform/retry/all-rejected/leave warning; and Management UI/backend denial. The existing nine journeys were updated for the wizard and filter disclosure, including inline campaign creation, Back/edit/recheck, completed-import retention and staging deletion.

## Verification record

| Command                                                                                                                                               | Result                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                                                                                                                      | Passed after correcting fixture types; includes API, web, and shared types.                                                                                                        |
| `pnpm test:unit`                                                                                                                                      | Passed: 50 tests across 15 files.                                                                                                                                                  |
| `pnpm test:integration`                                                                                                                               | Passed: 53 tests across six files; 459.09 seconds on the populated isolated test database.                                                                                         |
| `pnpm build`                                                                                                                                          | Passed: shared package, API, and production Next.js build. Subsequent browser runs rebuild the latest web source.                                                                  |
| `pnpm lint`                                                                                                                                           | Full command reports a pre-existing formatting issue in the untracked user file `apps/api/scripts/local-campaign-cleanup.ts`. The file was preserved.                              |
| `pnpm --filter @smd/web lint`                                                                                                                         | Passed.                                                                                                                                                                            |
| `pnpm exec prettier --check apps/api/src apps/api/prisma apps/api/prisma.config.ts <tracked API script paths> --ignore-path apps/api/.prettierignore` | Passed, including new source/test files and tracked scripts; excludes only the unrelated untracked script. Script paths were obtained with `git ls-files 'apps/api/scripts/*.ts'`. |
| `pnpm test:e2e`                                                                                                                                       | Passed: all 13 journeys, 1.6 minutes, latest production web build and isolated API/database.                                                                                       |

Browser follow-ups corrected an accessible platform label, a test locator that also matched the Next.js route announcer, fixture concurrency, stale metadata refresh ordering, newly visible trend-table overflow, and catalogue editing blocked by analytics refresh. Initial dashboard loading is allowed 30 seconds on the populated isolated fixture. Smoke journeys run sequentially; load testing remains separate. Captured confirmation and results screens were visually reviewed. The local web page, two static assets, and API health endpoint returned HTTP 200.

The initial code-format check also found new-file formatting, which was corrected. Initial expanded typechecking found fixture-only required creator/updater fields and a compound platform uniqueness lookup; those fixtures were corrected before the successful integration run. Existing PostgreSQL-driver deprecation warnings were observed; no database lock waits were found during the checked integration run.

## Files changed

- API: `apps/api/src/imports/imports.service.ts`, new `import-summary.ts`, `import-summary.test.ts`, `import-guidance.integration.test.ts`; `apps/api/src/reports/reports.service.ts`.
- Shared navigation/dashboard: `apps/web/components/workspace-shell.tsx`, new `workspace-navigation.tsx`; `apps/web/app/globals.css`; `apps/web/features/dashboard/overview.tsx`, `kpi.tsx`; new `apps/web/lib/available-metric.ts`; `apps/web/lib/api-client.ts` cancels stale requests and expires metadata before refreshing mutation results; `apps/web/features/catalogue/catalogue-management.tsx` displays refreshed catalogue data before awaiting analytics.
- Imports: `apps/web/features/imports/imports.tsx`; new `guided-import.tsx`, `import-types.ts`, `create-import-campaign.tsx`, `import-fields.tsx`, `import-review.tsx`, `import-history.tsx`.
- Results/campaigns: `apps/web/features/analytics/analytics.tsx`, `apps/web/features/reports/reports.tsx`, new `report-download.tsx`, `apps/web/features/campaigns/campaign-details.tsx`.
- Browser coverage/isolation: `e2e/smoke.spec.ts`, new `e2e/guided-ux.spec.ts`, `playwright.config.ts`, `apps/api/scripts/run-e2e.ts`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`. Smoke journeys run serially against shared fixtures; test builds use `.next-e2e` to preserve development assets.
- Documentation: proposal, this evidence, completion handoff/ledger, implementation progress, import and user guides.

The existing untracked improvement brief and local campaign-cleanup script were preserved. No commit or push is claimed for this request.

## Limitations

- Unfinished drafts remain in memory. Back and inline campaign creation work, but leaving/refreshing cannot resume the draft; the UI warns about this.
- Import action suggestions do not infer an append/merge policy from filenames. Existing backend validation supplies conflict evidence, and the user confirms the selected action before a fresh validation and commit.
- Multi-campaign results open one campaign at a time through separate exact-scope links; no new multi-campaign analytics API contract was added.
- The four-click claim applies to a recognised single-sheet file with existing campaign context. New campaigns and ambiguous fields need extra decisions.
- Stakeholder usability testing without coaching remains to be performed; automated browser journeys verify behaviour, not human comprehension.
- Original import-approval provenance remains an existing governance question. No formats were expanded.
