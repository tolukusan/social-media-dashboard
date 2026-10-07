# Implementation Progress

## Completed

- M00 Repository Foundation: pnpm workspace, Next.js web app, NestJS API, health route, environment placeholders, checks, and smoke scaffolding.
- M01 Database & Seed Foundation: Prisma 7/PostgreSQL schema, isolated application schema migration, deterministic roles/channels/platforms/metric seed, and aggregation metadata.
- M03 Channels & Platforms: Administrator create/edit/activate/deactivate lifecycle, active-only selections, normalized validation/conflicts, and protection against moving campaign-referenced platforms; verified through service and isolated HTTP/database tests.
- M04 Campaign Management: Campaign edit, search/status filtering, transactionally safe association additions, completed-campaign permissions, and create/edit/archive browser journey; verified through HTTP/database integration and Playwright.
- M05 Performance Data Entry: Dynamic applicable raw metrics, daily manual create/edit, Administrator archive, blank-versus-zero persistence, duplicate/date/value validation, and provenance/search/filter UI; verified through isolated HTTP/database and browser journeys.
- Structured Import Workflow: CSV/JSON/XLSX two-phase staging, deterministic source adapters and aliases, row validation/conflicts, checksum duplicate detection, atomic normalization, provenance, new stakeholder raw metrics, `/imports` UI, and import tests.

## Partial

- M02 Authentication & User Management: Argon2id login, opaque database sessions, HttpOnly cookies, logout/me, role guards, an Administrator-only Users screen, user list/create/update/role assignment/deactivate/reactivate/reset workflows, own display-name editing, login throttling, CSRF token flow, security headers, and frontend session-gated login/logout flow. Role guard allowed/denied matrix is covered; full live mutation matrix remains limited to local smoke coverage.
- M06 KPI & Analytics Engine: framework-neutral KPI calculation core, golden tests, authenticated dashboard/trends/comparison endpoints, date/campaign/channel/platform filters, archived-record exclusion, persisted Administrator-only KPI targets with overlap/scope validation, period-aware dashboard/PDF target results, pure target precedence/status helpers and automatic trend grain. Simultaneous no-data/no-target status remains unresolved (F06c).

## Current

- M07 Dashboard: responsive blue-accent multi-view shell with API-backed KPI values, shared date/campaign/channel/platform/metric/target filters, campaign/performance tables, target status table, loading/error/empty states, labels, focus visibility, and responsive layout. The backend trend series now appears in an accessible data table; Recharts rendering and a dedicated Analytics view remain (F07/F08).
- M08 Reports & PDF Export: authenticated dashboard PDF endpoint and report screen with safe filename and shared AnalyticsService values. Actual PDF contains title, period, record count and KPI code/value lines; generation date, filter labels, comparisons, charts and pagination remain (F09).
- M09 Administration Hardening: Administrator-only campaign/performance archival and transactional AuditLog events for archive actions.
- M10 Security & Quality Hardening: CSRF token flow, login throttling, security headers, validation pipe, CORS allowlist, and session controls implemented; full automated matrix remains.
- M11 Testing & Performance Validation: 22 API tests pass, Playwright navigation/keyboard smoke passes (1 active, 1 credential-gated skip), validation/role matrices are covered, and the 25-VU/10-second k6 health baseline passes with 1,250 checks and 0 failures. The Administrator Users workflow uses the existing backend role guard and CSRF/session flow. Full browser accessibility tooling remains outside the local dependency set.
- M12 Local Documentation: local operations, backup/restore, user guide, developer guide, and academic evidence checklist added. External deployment remains unauthorized/unavailable.

## Historical verification reports (not rerun by completion baseline)

- lint: passing (`pnpm lint`)
- typecheck: passing (`pnpm typecheck`)
- tests: passing, 22 API/unit tests plus workspace test commands (`pnpm test`)
- live security smoke: CSRF issuance, login, HttpOnly session cookie, and authenticated channel listing passed
- frontend root cause: `apps/web/app/globals.css` existed but was not imported by `app/layout.tsx`; the import is now restored
- frontend auth smoke: unauthenticated load calls `/auth/me` without protected data requests; authenticated login, navigation, and logout passed
- Administrator user management: role choices, user lifecycle actions, and password reset are wired through Administrator-only API and CSRF-protected frontend actions; no public signup route was added
- Playwright: `pnpm exec playwright test` passed (2 smoke/navigation and keyboard tests)
- k6: `k6 run performance/k6-health.js --summary-export docs/evidence/performance/k6-health-summary.json` passed (25 VUs, 1,250 checks, 0 failures)
- build: passing (`pnpm build`)
- database migration: applied cleanly to local PostgreSQL schema `social_media_dashboard`
- database seed: passing (`pnpm --filter @smd/api prisma:seed`)
- live smoke: health, login, HttpOnly cookie, password-hash omission, and authenticated channel listing passed with an ephemeral local admin seed
- structured import live smoke: CSV fixture preview, mapping, validation, confirmation, provenance query, analytics record visibility, and completed-checksum duplicate warning passed locally
- import parser tests: UTF-16 Meta-style CSV preamble, JSON array/missing value semantics, multi-sheet XLSX, deterministic aliases/adapters

## Completion execution — 2026-10-05

- R00: local Git initialised on main; 119 non-sensitive recovery copies SHA-256 verified. No files moved/staged/committed. TODO temporarily ignored; only redacted recovery retained. See [inventory](../plans/completion/reorganisation-inventory.md).
- F00: every M02–M12 acceptance checkbox mapped to source/test evidence and completion owner in [acceptance matrix](../plans/completion/acceptance-matrix.md). Historical verification claims remain historical; no runtime acceptance inferred.
- R01: added navigation/readmes, replaced credential-bearing TODO with a safe launcher and preserved unique operating restrictions; active governance points to the general-purpose completion ledger.
- R02: 71 intended guide/reference/evidence/snapshot moves verified against recovery hashes; active links updated. Original canonical specification formatting preserved where no moved-path updates were needed.
- R03: extracted existing non-import UI into features/components/lib and a thin route; all 16 original function bodies match AST comparison. Imports route bytes unchanged; its extraction waits for meaningful workflow tests.
- R04: lint/type discovery includes extracted source, format:docs checks maintained documents, backups/generated/runtime output ignored, E2E_BASE_URL can select the actual frontend origin.
- R00/F00/R01/R02/R03/R04 evidence is summarised above. Markdown: 135 active relative links resolved at R02; `pnpm format:docs` passes.
- F01: standardised the API unit runner on Vitest 5.0.3 (9 files, 27 tests); added dedicated `test:unit`, `test:integration`, `test:e2e`, and safe test-database preparation commands. Existing Node tests and assertions were migrated without changing test bodies.
- F01: created and retained a unique local PostgreSQL test database `smd_test_<random>`; applied the three existing migrations and seed only to that database. The integration suite verifies actual database platform-code uniqueness, health, and unauthenticated HTTP denial. No migration files changed and no development database was reset.
- F01: automated isolated E2E startup checks ports, migrates/seeds the test DB, creates random Argon2id credentials for all three fixed roles, builds the web app against the test API, starts both services, runs Playwright and stops the services. Credentials and test URL are ignored local files.
- Current verification: `pnpm test:db:prepare`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (27 API tests), `pnpm test:integration` (2 real PostgreSQL/HTTP cases), `pnpm test:e2e` (3 browser cases), `pnpm build`, and `pnpm format:docs` pass. The E2E suite covers unauthenticated gating, Administrator login/navigation/logout, and login for Administrator, Marketing Officer, and Management with Management read-only controls. No test server remains listening after the command.
- Build emits the existing Next.js workspace-root warning because an additional lockfile exists at `C:/Users/user/package-lock.json`; production build succeeds. Direct pnpm Playwright invocation can fail on a Windows path containing spaces; the reproducible E2E runner launches Playwright through Node.
- No application migration or KPI semantics changed. The isolated test database is intentionally retained for reuse. Next: F02 frontend request/session/form foundation; R03 import UI extraction remains pending meaningful workflow coverage. Historical import-promotion approval remains unresolved in `BLOCKERS.md`.

## Completion execution — F02 partial

- Added compatible TanStack Query and React Hook Form dependencies without changing Next.js or React major versions. Added a shared typed request helper with credentialed requests, JSON/error parsing, 401/403 distinction, and CSRF acquisition/header handling for unsafe methods. No session tokens are stored in browser storage.
- Added a root query provider. The workspace session query resolves before protected dashboard/campaign/performance/channel requests; query keys include user identity and date filters. Logout revokes the server session, sets local identity unauthenticated, and clears identity-dependent cached data. Workspace loading handles a 401 by expiring the local identity.
- Migrated all application API requests through the shared client, including multipart import preview and authenticated PDF download; its read/write methods normalize backend errors, credentials, and CSRF behavior. Added filtered report/workspace query keys and invalidation for campaign, catalogue, user, and import mutations. Revalidated session on window focus and evicted user-dependent query data when the identity changes or expires. The imports route now resolves identity before protected API requests.
- Adopted React Hook Form for login, campaign creation, and platform creation, preserving values after server errors and resetting successful submissions. Kept the current CSS and blue design unchanged. Tailwind is not configured: the package is absent from the local dependency store, and the installed NVM guard rejects `pnpm` and `corepack` with NVM4306. No global tool trust settings were changed. Verification used installed local Node entrypoints: Prettier and web typecheck passed; 27 unit tests and 2 isolated PostgreSQL/HTTP integration tests passed; production build passed after setting the repository as Next.js explicit tracing root; all 3 Playwright cases passed, including authenticated import-screen/history access. The E2E runner needed a temporary process-local `os.userInfo()` fallback because this sandbox returns `ERR_SYSTEM_ERROR` for that Node API; the temporary file was removed. No migration or KPI/security business rule changed.

## Completion execution — F03 partial

- Added an Administrator-only `PATCH /users/:id` for permitted name, normalized email, and fixed-role updates. It rejects empty updates, invalid roles/names, duplicate normalized emails, and unknown request fields; responses omit `passwordHash`.
- Added authenticated `PATCH /auth/me` for the caller’s own display name. It takes identity only from the session, rejects caller-supplied IDs through the production validation pipe, and returns a sanitized user. The session guard now selects only public user fields, and `/auth/me` defensively strips `passwordHash` as well.
- Added Administrator edit controls and a role/name/email form to Users; added a self-profile screen available to every role. Both use React Hook Form and the shared CSRF-aware API client.
- Added actual HTTP/PostgreSQL integration coverage for Administrator update, normalized email, Management denial/no mutation, CSRF enforcement, own-profile scoping, unknown-field rejection, and absence of password hashes. The integration app now installs the same global validation pipe as production. Playwright covers self-profile save alongside login/logout, import screen access, and the fixed-role checks.
- Verification: API/web typechecks passed; 27 Vitest unit tests passed; 3 isolated PostgreSQL/HTTP integration tests passed; all 3 Playwright cases passed; Next production build passed. Tests used local Node entrypoints because NVM blocks pnpm/corepack. No migration or session revocation behavior changed.
- Own-password change remains blocked at this detail only: PQ-005 permits it, but the approved security documents do not state whether a current password is required or whether the current/all active sessions must be revoked after the change. Administrator-assisted reset remains unchanged. See `BLOCKERS.md`; continue other independent work.

## Completion execution — F04a complete

- Added Administrator UI to create, edit, deactivate, and reactivate channels and platforms. Inactive entries remain visible in the catalogue; campaign and import selection lists continue to exclude inactive channels/platforms.
- Hardened catalogue writes against blank-after-trim and invalid-length names/codes, normalized duplicate-code conflicts to HTTP 409, and prohibited moving a platform once a campaign references it. Deactivation remains a reversible active/archive timestamp update, preserving entity rows and historical labels.
- Added a focused service regression test and isolated PostgreSQL/HTTP integration coverage for non-admin denial, Administrator create/deactivate, code normalization, and archive retention. The existing imports screen reads the updated active catalogue on load.
- Verification: API and web TypeScript checks passed; catalogue unit tests passed (3); isolated API integration tests passed (4); Next.js production build passed. Prettier was applied to changed code and the execution ledger. The browser suite exercised campaign flows but did not exercise catalogue lifecycle controls. No migration or formula/permission rules changed.

## Completion execution — F04b complete

- Added campaign editing for name, description, objective, target audience, dates, status, budget, and notes while displaying the current responsible user and preserving channel/platform associations unless explicitly changed through the API. Added campaign name/channel search and status filtering with a clear no-results state.
- Fixed campaign creation cache reconciliation to replace by ID instead of showing a duplicate after refresh. Backend update validates supported status values, rejects blank names/invalid date ranges/missing assignees, treats a cleared end date as open-ended, and commits requested association additions together with campaign fields in one transaction. Link removals remain rejected. After completion, Marketing Officers may change metadata; structural additions require Administrator, following WF-007/WQ-002.
- Added HTTP/PostgreSQL coverage for Marketing Officer metadata edits, Administrator structural additions, Management denial, mismatched platform/channel, invalid status/date/assignee, and persistence after rejected writes. Playwright now covers create -> edit -> search/status filter -> archive; isolated E2E run passed all 3 cases.
- Verification: API/web typechecks passed; 28 unit tests passed; 5 isolated HTTP/database integration tests passed; 3 Playwright E2E tests passed; production build passed; Prettier checks passed. The runner used the installed Node executable and a temporary process-local `os.userInfo()` fallback due sandbox `ERR_SYSTEM_ERROR`; temporary files were removed. No migration or KPI rule changed.

## Completion execution — F05 complete

- Added authenticated `GET /channels/:id/metrics` metadata and a dynamic manual performance form built from a selected campaign-platform link. It displays only input-enabled raw metrics for active contexts; count inputs use whole-number steps, zero is numeric, and blank values stay omitted.
- Added create/edit forms, record search/date filters, provenance display, and Administrator-only archive confirmation. Marketing Officers can create and edit; Management stays read-only. Successful mutations invalidate workspace data so dashboards and records refresh.
- Hardened the API to enforce active campaign/channel/platform context for new records, active applicable RAW metric definitions, non-negative values, whole-number COUNT units, positive POSITION values, campaign date bounds, and existing email sent/delivered validation. Omitted `values` on PATCH leaves the metric set unchanged; supplied `values` replaces it, with an empty object clearing all metric rows. Update now commits values and record metadata in one transaction.
- Preserved the existing database uniqueness rule for all records, including archived rows. Friendly conflict responses cover pre-existing, archived-date, and concurrent duplicate submissions; archived rows retain metric/history data and disappear from the normal active list.
- Added isolated HTTP/PostgreSQL coverage for metadata, permissions, future/out-of-campaign dates, fractional and negative counts, derived-metric rejection, concurrent duplicate creates, zero versus missing, omitted-values PATCH, archive retention/list exclusion, and archived-date reservation. Playwright covers manual create, dashboard record-count refresh, edit, and archive.
- Verification: API/web typechecks passed; 28 unit tests passed; 6 isolated HTTP/database integration tests passed; all 3 E2E tests passed; Next production build passed. No schema migration, KPI formula, or import format changed.

## Completion execution — F06a partial

- Analytics transport now carries date/campaign/channel/platform/metric filters, raw totals, derived values, metric labels/units/kind/aggregation strategy, filter-scoped record/campaign/active-channel counts, and deployment reporting context. Dashboard, trend buckets, comparisons, and dashboard PDF use the same filtered calculation path; unknown or inactive metric selections are rejected.
- Calculation uses the approved aggregation strategy before formulas. Website and advertising conversions are returned as distinct raw totals and shown separately; the prior fallback between them is removed. Aggregated reach is labelled as daily aggregate with its non-deduplicated-period caveat. UI number formatting uses metadata units and configured reporting currency when present.
- Repeated imported rows now use declared SUM/FIRST/LAST or the approved SEO position weighted-average rule. Metrics with undefined weighted aggregation are rejected rather than summed. Missing SEO positions do not enter the weighted numerator or denominator; missing inputs remain null, explicit zero remains zero, and zero denominators return unavailable.
- Added golden cases for CTR aggregation, zero/missing values, conversion families, weighted position and FIRST/LAST metadata, plus duplicate import aggregation. Added isolated PostgreSQL/HTTP coverage for combined date/campaign/channel/platform/metric filters, scoped counts, metric metadata, explicit zero, trend parity, and report endpoint parity.
- Verification: API and web typechecks passed; API unit suite 32 tests passed; isolated PostgreSQL/HTTP integration suite 6 passed; API TypeScript build passed; Next production build passed; Prettier check passed. No migration or schema change. An initial root-level Vitest invocation also discovered archived backups and failed two stale copies; rerunning from `apps/api` passed all current suites.
- `REPORTING_CURRENCY` is read from deployment configuration and returned as null when unset; this workspace has no approved deployment currency value. Do not infer a currency. Reporting timezone reads the configured `REPORTING_TIMEZONE`. See `BLOCKERS.md`; this does not block F06b work.

## Completion execution — F06b complete

- Kept automatic daily/weekly/monthly trend grain and now emits explicit null-valued points for empty buckets, preserving visible gaps without fabricating zero.
- Added calendar MONTH/QUARTER/YEAR comparison modes. Partial periods compare matching elapsed calendar portions; custom comparisons remain labelled `CUSTOM` and use the preceding equal-length date window. Responses include exact current/previous boundaries and partial-period status.
- Added absolute and percentage differences. Zero-to-zero is 0%, zero-to-positive is unavailable, and absent values remain null; no division by zero can produce infinity.
- Added a campaign/channel dimension comparison endpoint for 2–8 distinct selections using one common metric. Channel selections must all have that active metric; campaign lifetime comparisons include each campaign duration. Existing date, campaign, channel, and platform filters remain intersected where compatible.
- Added tests for September 1–23 versus August 1–23, leap-year full-year boundaries, custom equal-length windows, percentage edge cases, 31/32/120/121-day grain thresholds, empty trend buckets, HTTP calendar-comparison boundaries, and campaign lifetime comparison durations.
- Verification after F06b: API typecheck/build and Prettier checks passed; 35 API unit tests passed; all 6 isolated PostgreSQL/HTTP integration cases passed. No schema migration. Frontend did not change, so browser verification was not applicable; chart and comparison views remain F07/F08.

## Completion execution — F06c partial

- Dashboard analytics now accepts an explicit matching target period (daily, weekly, monthly, quarterly, yearly, or campaign lifetime). Non-campaign targets require exact complete calendar boundaries; effective dates must cover the entire evaluated period. Monthly targets are never prorated.
- Applicable target data is joined by approved KPI definition, resolved with campaign > platform > channel > global precedence, and returned with actual, target value, comparison rule, scope, period, effective dates, and neutral status. Existing PDF assembly consumes the same target evaluation and renders target/status lines.
- Target create/update overlap validation now serializes writes with a PostgreSQL transaction-scoped advisory lock per KPI/scope/period key. Concurrent overlapping API writes produced one create and one conflict in isolated PostgreSQL. Existing Administrator-only RBAC remains enforced.
- Added tests for full-period effective-date coverage and both comparison directions. HTTP/database coverage exercises Administrator versus Management writes, invalid scope rejection, concurrent overlapping creates, target actual/status, shortened effective dates, target-period mismatch, campaign-lifetime no-data handling, and PDF/dashboard parity.
- Verification: 36 API unit tests passed; all 6 isolated PostgreSQL/HTTP integration cases passed; API and web typechecks passed; API build and Next production build passed; Prettier checks passed. No schema migration.
- Unresolved approved-rule ambiguity: when actual is unavailable and no target applies, the API returns `status: null` with `statusDecisionRequired: true` rather than choosing between `NO_DATA` and `NO_TARGET`. See `BLOCKERS.md`. This does not block independent UI and repository tasks; target status display should retain the unresolved state until clarified.

## Completion execution — F07 partial

- Overview and Analytics now share one date/campaign/channel/platform/metric/target-period filter state. Changes drive dashboard, trends, and report preview/download requests; channel changes clear dependent platform and incompatible metric choices. Backend metadata supplies labels, units, and channel applicability.
- Added channel-aware KPI selection, target evaluation table with the unresolved status shown clearly, and an accessible trend table from backend bucket values. Empty buckets remain “Unavailable”; loading, retry, no-data, and filtered-empty messages are distinct. Removed the user-facing API endpoint placeholder.
- Extended Playwright smoke coverage for date/campaign/metric filtering and real trend bucket output. All three browser cases passed in the isolated runner. API/web typechecks, API build, and Next production build passed; current browser session had no app errors observable in Playwright.
- Recharts chart rendering remains blocked by missing dependency installation (NVM4306/network restriction); see `BLOCKERS.md`. The accessible data table remains available. No migration.

## Completion execution - F08 partial

- Added a dedicated Analytics view for selected metric period comparison and campaign/channel comparison, including exact backend periods, absolute/percentage difference, units, and campaign lifetime durations. Added an Administrator target create/edit/end-date screen and read-only target listing for other roles.
- Verification: API/web typechecks; API unit 36; isolated HTTP/PostgreSQL integration 6; production Next build; all 3 Playwright cases passed. The E2E run checks the Analytics comparison tables and target visibility by role. No schema migration.
- Recharts line plots remain outstanding under the F07 NVM4306 dependency blocker.

## Completion execution - F09 partial

- Added a shared report assembly path used by both authenticated JSON preview and PDF download. It includes generation time/reporting timezone, named filters, exact period, KPI values with units, target status, counts, a period comparison, trend points, and aggregation caveats. The preview displays the same filters and values, identifies unset currency/timezone, and distinguishes no matching records from zero-valued metrics.
- Added HTTP checks for anonymous denial and dashboard/trend/comparison parity; browser smoke covers preview and PDF download. Verification: API/web typechecks; Prettier; API unit 36; isolated integration 6; production Next build; Playwright E2E 3 passed. No migration.
- The current single-page handwritten PDF renderer remains. PDFKit was not available in the local cache, and `pnpm add pdfkit --filter @smd/api` is blocked by NVM4306. Pagination, embedded chart, font/non-ASCII rendering, and sample visual inspection await the approved package-manager path.

## Documentation organisation - 2026-10-06

Retention follow-up: the stakeholder explicitly authorised removal of .reorganisation-backup/ on 2026-10-06. Temporary snapshots and one-time helpers were removed; historical verification commands below record past execution and are no longer runnable. Active navigation was updated. Application files and curated historical source bundles were preserved.

Completed the stakeholder-requested topic grouping of 25 documents. Updated docs/README.md, active references in root and .ai guidance and current plans, manifest placement guidance, and package.json format:docs coverage. The [move record](../plans/completion/documentation-reorganisation.md) lists every destination and the verified recovery location. Business rules, archived bundles, application code, and migrations are unchanged. No tests added or updated; runtime lint/typecheck/unit/integration/build/E2E were not rerun because this changes documentation navigation only. Verification: active local Markdown links and maintained documentation Prettier checks passed; archive bundles excluded from all edits. No new blockers.

Commands: node .reorganisation-backup/check-docs.cjs (155 links resolve); node .reorganisation-backup/check-doc-integrity.cjs (24 moved specifications match original content after intended path/note/format changes); node node_modules/prettier/bin/prettier.cjs --ignore-path .prettierignore --check README.md TODO.md AGENTS.md BLOCKERS.md .ai docs (passed). Formatting was corrected after the expanded check exposed previously skipped files. Git still ignores Markdown/docs via existing .gitignore rules; local edits are present but absent from git diff.

## Password recovery implementation - 2026-10-07

- Commit `4654f51` added self-service email recovery: an additive `PasswordRecoveryToken` migration, hashed single-use 30-minute tokens, replacement invalidation, Argon2id password replacement, active-session revocation, safe audit events, bounded in-process SMTP delivery, recovery pages, and isolated HTTP/PostgreSQL coverage.
- The continuation branch requires the configured application Origin for login as well as recovery, adds allowed/disallowed/missing-Origin login coverage, preserves a valid reset token after retryable API/network failures, adds a browser regression for retryable-versus-terminal reset errors, and adds app-local API/web environment templates including the SMTP placeholders required for real delivery.
- Verification status for this continuation: source and tests were reviewed and updated through GitHub, but repository lint/typecheck/unit/integration/build/E2E commands were not run here and the source commit has no GitHub Actions run. Actual inbox delivery remains unverified until an authorised SMTP provider is configured. No deployment was performed.

