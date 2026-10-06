# Product completion implementation plan

Status: proposed. Date: 2026-10-05. Read [the handoff](README.md) first.

## Objective and boundaries

Complete the existing general-purpose marketing MVP so an authorised user can create a campaign, enter or import raw data, review accurate KPIs, filter and compare performance, inspect trends and targets, and export a useful report.

Preserve the approved blue-accent SaaS visual direction, single organisation per deployment, fixed roles, daily records, backend calculations, opaque sessions, and PostgreSQL/Prisma architecture. Do not add live integrations, AI recommendations, predictions, builders, scheduled reports, education-specific features, or new infrastructure. Preserve existing imports without expanding supported source formats in this plan.

## Evidence from the planning inspection

These are source observations, not runtime test results. Recheck before implementation.

| Area                 | Observed state                                                                                                                                        | Task    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Progress             | `docs/evidence/IMPLEMENTATION_PROGRESS.md` understates campaign/platform UI work and overstates some reporting/comparison capabilities                | F00     |
| Frontend stack       | TanStack Query and React Hook Form added in F02; Tailwind remains pending F02, Recharts pending F07                                                   | F02     |
| Accounts             | Administrator update and own display-name routes/UI added; own-password route awaits an approved current-password and session-revocation policy       | F03     |
| Catalogue            | API supports channel/platform updates; UI adds platforms and toggles their active state, but does not expose the complete catalogue lifecycle         | F04     |
| Campaigns            | Creation/detail/archive UI exists; update workflow needs reconciliation against the API and approved fields                                           | F04     |
| Performance          | List exists; `Add record` has no handler; create/update/archive APIs exist                                                                            | F05     |
| Analytics values     | `calculateKpis()` returns derived KPIs and emails sent; UI also asks for conversion values absent from that return object                             | F06a    |
| Targets              | Persistence and pure target helpers exist; inspected dashboard service does not fetch/apply targets                                                   | F06c    |
| Comparison           | `comparisonPeriods()` returns the immediately preceding equal-length window; built-in calendar comparisons require different semantics                | F06b    |
| Charts/filters       | Overview exposes dates and a placeholder chart; Analytics renders the same component; trend endpoint is not plotted                                   | F07-F08 |
| Reports              | Hand-built single-page PDF contains title, period, record count, KPI code/value lines; preview claims a generation date that the generator omits      | F09     |
| Verification         | `node:test` is implemented although approved strategy selects Vitest absent compatibility evidence; current browser smoke has a credential-gated skip | F01     |
| Performance evidence | Existing k6 script exercises health, not the approved authenticated application workload                                                              | F11     |

Primary inspected files: `apps/web/app/page.tsx`, `apps/web/app/imports/page.tsx`, API `auth`, `users`, `channels`, `campaigns`, `performance`, `analytics`, `targets`, `reports`, workspace package manifests, `e2e/smoke.spec.ts`, and `performance/k6-health.js`.

## Common verification and data rules

For each code task, run relevant focused tests followed by `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Run relevant Playwright tests whenever the task changes a critical user journey. Record discovered integration commands under F01; do not claim `pnpm test` covers PostgreSQL until verified. Re-run broad checks after subsequent code changes, not repeatedly without a reason.

Current `lint` scripts are Prettier checks, not a full static-analysis suite. Report them accurately. New source directories must be included in checks (R04).

No schema migration is presumed necessary for UI completion. If a task needs a schema change, use `.ai/skills/database-change/SKILL.md`, establish the approved domain basis, create an additive migration, verify integrity and old-data compatibility, and test against an isolated clean PostgreSQL test target. Never reset the development database. Do not alter applied migrations.

For analytics, use `.ai/skills/analytics-change/SKILL.md`; for auth, permissions, sessions, audit, or sensitive data, use `.ai/skills/security-change/SKILL.md`. All mutations must retain backend RBAC, input validation, and CSRF protection.

## F00 - Reconcile acceptance criteria and evidence

Dependencies: R00. Maps to M02-M12. Documentation-only task.

Read: `docs/evidence/IMPLEMENTATION_PROGRESS.md`, `docs/plans/M02-*.md` through `M12-*.md`, relevant sections of `docs/product/requirements.md`, `docs/product/scope.md`, `docs/product/permissions-matrix.md`, and `docs/governance/design-amendments-v1.1.md`.

Steps:

1. Create `docs/plans/completion/acceptance-matrix.md` with rows for each remaining milestone criterion. Include requirement reference, UI/API/test evidence, status, and owning F task.
2. Distinguish implemented, partially implemented, missing, unverified, and blocked. Preserve existing passing evidence with its actual provenance; do not present old runs as current.
3. Correct stale progress descriptions using inspected code. In particular, distinguish pure calculation helpers from integration into HTTP responses, and actual PDF content from frontend preview text.
4. Find any explicit import-promotion task or approval. Link it if available; otherwise record that its provenance is unresolved, preserve the implementation, and leave expansion out of scope.
5. Record existing deviations from approved tooling: runner, missing UI dependencies, reporting renderer. Attach each actionable discrepancy to a task rather than silently rewriting design documents.

Acceptance: every incomplete criterion has an owner or concise blocker; no completed milestone is claimed from filenames alone. Verify links and changed Markdown formatting. No migrations or runtime changes.

## F01 - Make verification reproducible

Dependencies: F00, R04. Maps to M00/M01 verification and M11 foundations.

Read: `docs/operations/test-strategy.md`, `docs/guides/local-operations.md` or its R02 destination, API Prisma configuration/schema, package scripts, test fixtures, and Playwright configuration.

Expected changes: root/API/web package scripts as necessary, test setup/fixtures, `e2e/`, test configuration, developer guide. Preserve the current unit tests.

Steps:

1. Run existing checks and record failures before changing test tooling. Do not fix unrelated regressions under this task.
2. Inspect whether an approved exception explains `node:test`. If no such evidence exists, migrate tests to the approved Vitest runner in a bounded subtask; do not run two permanent backend unit runners. Preserve all assertions and meaningful test cases. If a genuine compatibility barrier exists, document it and stop only the migration subtask.
3. Provide explicit `test:unit`, `test:integration`, and `test:e2e` commands (or documented equivalents). Integration tests must use real PostgreSQL and actual HTTP/session guards where applicable.
4. Establish an isolated test target compatible with Prisma's explicit application schema. Prefer a dedicated test database; do not assume a connection URL schema parameter overrides `@@schema`. Refuse development/production targets before setup, migrations, or cleanup. If creation is unavailable, request a suitable test target rather than resetting `postgres`.
5. Create deterministic role/channel/platform/campaign fixtures; generate ephemeral test credentials locally without printing or committing them. Test teardown may remove only test-owned records in the verified isolated target.
6. Make browser startup, API origin, migration/seed prerequisites, and three-role authentication reproducible. Ensure required acceptance journeys fail setup clearly rather than silently skip when credentials are missing.

Acceptance/tests: prove test isolation, run retained unit cases, one real database integrity test, and login/read-only smoke. Document exact commands and passed/failed/skipped counts. Migration impact: none expected; apply existing migrations to the isolated target.

## F02 - Shared frontend request, session, and form foundations

Dependencies: R03-R04, F01. Maps to M02/M07 supporting infrastructure.

Read: `docs/architecture/tech-stack.md`, `docs/architecture/architecture.md`, `docs/operations/security.md`, extracted web session/API code, `apps/web/app/imports/page.tsx`.

Expected changes: `apps/web/lib/`, providers, `apps/web/features/auth/`, web package/lockfile, limited style/build configuration.

Steps:

1. Add the approved TanStack Query and React Hook Form libraries using versions compatible with installed Next/React. Add Recharts when first consumed in F07. Follow official version-specific documentation during implementation; no major framework upgrades.
2. Create one typed API client that includes credentials, handles JSON/error responses, sends existing CSRF tokens on unsafe methods, and distinguishes 401 from 403. Never store session tokens in local storage.
3. Add a session provider/query and wait for identity resolution before protected queries. Clear identity-dependent cache on logout, expiry, or account changes.
4. Define query keys that include every filter; invalidate affected campaign/performance/dashboard/trend/target/report queries after mutations. Avoid duplicate initial session requests and stale results after switching filters.
5. Adopt React Hook Form for new/modified forms, retaining backend validation as authoritative. Preserve server error details suitable for users and entered values after errors.
6. Add the approved Tailwind setup in a separate bounded change if no approved exception exists. Preserve the current CSS and blue visual design; verify base-style changes before introducing utilities. Do not rewrite every stylesheet.

Acceptance/tests: login/logout and expiry still work, unauthenticated loads do not request protected data, rapid filter changes do not show stale results, mutations carry CSRF, imports remain functional. No database migration.

## F03 - Finish account and user-management workflows

Dependencies: F02. Maps to M02/M10.

Read: `docs/product/permissions-matrix.md` (including PQ-005), `docs/operations/security.md`, M02 plan, API auth/users DTOs/services/guards, Users UI.

Expected changes: API `auth/`, `users/`, DTOs and tests; web auth/users features.

Steps:

1. Reconcile existing create, role selection, reset, deactivate/reactivate flows with the matrix. Add missing Administrator update actions for existing users, including permitted identity/role fields; validate fixed role values and unique normalised email.
2. Provide own-display-name editing and own-password change for authenticated users. Keep email changes Administrator-only. Do not add public signup or email-based recovery.
3. Apply approved password and session rules. Before implementing any unspecified own-password-change session/current-password policy, locate an approved rule or record a narrow decision blocker; do not guess security policy.
4. Verify existing logout, deactivation, Administrator reset, idle timeout, and absolute lifetime behaviour against security.md. Correct within approved rules; never weaken protection to pass a smoke test.
5. Show pending, success, field/server error, and expired-session states. Keep Management read-only for operational data while retaining its own-profile permissions.

Acceptance/tests: all permitted user actions work through UI; non-admin callers cannot update another user or assign roles; own-profile endpoints cannot accept another user ID to bypass ownership; password hashes/tokens never appear in responses. Test session revocation and CSRF with real requests. No schema change expected.

## F04 - Complete catalogue and campaign management

Dependencies: F03. Maps to M03/M04. Execute F04a then F04b separately.

Read: M03/M04 plans, `docs/architecture/domain-model.md`, `docs/product/workflows.md`, `docs/product/permissions-matrix.md`, API channels/campaigns DTOs/services, extracted catalogue/campaign screens.

### F04a - Channels and platforms

1. Complete Administrator create/edit/activate/deactivate UI for both channels and platforms using existing endpoints.
2. Validate names/codes, active selections, and platform-to-channel association on the backend. Preserve historical labels and associations; do not casually reassign a platform used by records to another channel.
3. Show inactive catalogue items to administrators while keeping them out of new operational selection lists. Retain inactive labels in historical records.

Acceptance/tests: authorised lifecycle works; Marketing Officer and Management receive backend denials; existing campaign/performance history remains readable after deactivation. Verify imports use the updated active catalogue. No migration expected.

### F04b - Campaign editing and discovery

1. Retain existing creation/detail/archive behaviour. Add missing edit workflow using existing update API and the approved campaign fields/statuses.
2. Include permitted personnel selection without exposing the Administrator-only user-management list. If needed, add a minimal authenticated assignee lookup containing only fields required by the approved workflow.
3. Retain transactional channel/platform linking, date validation, and prohibition on removing links already used by performance records. Do not hard-delete linked data.
4. Add practical campaign search/status filtering and clear detail/edit navigation. Keep the screen table-oriented.

Acceptance/tests: Admin/Marketing Officer create and edit multi-platform campaigns; Management can inspect but cannot mutate; invalid status/date/platform/personnel inputs fail without partial writes; linked history survives edits/archive. Browser test create -> edit -> reload. No migration expected.

## F05 - Complete manual performance entry, correction, and archival

Dependencies: F04. Maps to M05/M09.

Read: M05 plan, `docs/product/workflows.md`, performance sections of domain model, KPI catalogue, permissions, API performance DTOs/service, Prisma metric definitions/applicability, existing import normalisation.

Expected changes: web performance feature, API performance and minimal metric/reference read endpoints if absent, integration/browser tests.

Steps:

1. Wire Add record to a real form: campaign -> linked platform/channel context -> calendar date -> applicable raw metrics. Resolve the actual CampaignPlatform identity; do not send a bare platform ID where a campaign link is required.
2. Expose approved metric metadata through authenticated API reads if absent: code, label, unit, raw/derived kind, applicability, active state. Do not hardcode an independent frontend metric catalogue or create a formula editor.
3. Keep blank values missing and explicit zero numeric. Enforce whole-number counts, non-negative values, valid position/email relationships, valid campaign dates, no future dates, and no derived metric submissions server-side.
4. Add record detail/edit actions for Admin/Marketing Officer and archive confirmation for Admin only. Inspect PATCH semantics for omitted versus cleared values before building the edit form; use approved rules and stop that detail if clearing semantics are undefined.
5. Show duplicate-date conflicts as actionable messages, preserve form inputs on errors, prevent duplicate pending submissions, and refresh records/analytics after success.
6. Add record filters/search consistent with API scope and existing pagination, if any. Imported and manual provenance remain visible. Do not alter import collision or archived-date uniqueness policy to make entry succeed.

Acceptance/tests: create -> reload -> edit -> dashboard refresh works; blanks and zero round-trip distinctly; duplicate/concurrent submissions do not create duplicate active daily records; forbidden/invalid requests do not mutate data; archive excludes the record from analytics without removing history. Test direct HTTP and browser journeys. No migration expected; any uniqueness-policy conflict requires the database skill and approved decision.

## F06 - Complete the authoritative analytics API

Dependencies: F05. Maps to M06. Execute F06a, F06b, F06c separately, each with its own tests.

Read: `docs/analytics/kpi-catalog.md`, `docs/analytics/analytics-rules.md`, `docs/analytics/kpi-target-rules.md`, design amendments, API analytics/targets, seed/schema, relevant import aggregation.

Use the analytics skill. No business calculations may move into web components. No new KPI formula is authorised.

### F06a - Values, metadata, filters, and aggregation

1. Define shared transport types for filters, units, raw totals, derived values, and unavailable states; do not export Prisma types to the web.
2. Return approved raw totals and derived metrics actually consumed by the UI. Remove the mismatch where conversion cards request keys never returned. Keep channel families explicit; never use a fallback between website and advertising conversions as a purported combined total.
3. Validate combined date/campaign/channel/platform/KPI filters consistently for summaries, trends, comparisons, and reports. Apply intersection semantics and approved archive rules; preserve historical data associated with deactivated catalogues.
4. Respect aggregation metadata: SUM, applicable FIRST/LAST, WEIGHTED_AVERAGE, DERIVED. Inspect how imported repeated daily rows handle non-additive metrics; preserve supported inputs and reject undefined aggregation rather than silently summing positions or snapshots.
5. Check missing/partial inputs, weighted SEO position, and numerator/denominator eligibility. A missing position must not become numeric zero. If the approved documents do not determine partial-pair semantics, record the exact decision needed and block only that calculation.
6. Return filter-scoped campaign/channel counts according to approved rules, metric labels, reporting currency, and reporting timezone. Label aggregated reach/users accurately. Do not infer conversion attribution or invent globally comparable metric families.

Acceptance/tests: known fixtures match formulas, metadata and filter results; unavailable is distinct from zero; no NaN/Infinity; archive/date/channel/platform/campaign isolation is verified through PostgreSQL.

Golden cases to add or retain:

- CTR: 1 click / 10 impressions plus 90 / 1,000 gives 91 / 1,010 * 100, approximately 9.0099%, not the 9.5% mean of row rates.
- Engagement: 20 / 100 reach plus 30 / 900 gives 5%; zero reach produces null.
- Weighted position: position 2 at 100 impressions and position 8 at 300 gives 6.5; missing/zero weights and missing positions have explicit approved treatment.
- Explicit zero numerator with positive denominator gives zero; absent numerator is not fabricated as zero.
- Same fixture split between two campaigns/platforms and one archived record proves filter/archive behaviour.

### F06b - Trend and comparison semantics

1. Keep automatic daily/weekly/monthly grain from approved rules; represent missing buckets as unavailable/gaps rather than measured zero. Calculate each bucket on the backend.
2. Add or repair built-in month/quarter/year comparisons: calendar periods, and matching elapsed portions for incomplete current periods. The existing previous equal-length range must not be labelled previous month/quarter/year.
3. Return current/previous boundaries and partial-period labels from the backend. If retaining custom equal-length comparisons, label them explicitly as preceding equal-length periods.
4. Return absolute differences and approved percentage changes. Zero -> zero is 0%; zero -> positive and missing baseline are unavailable; never infinity.
5. Add campaign/channel comparison response(s) using common approved metrics and explicit comparison dimensions. Reuse the same analytics service. Show campaign duration for lifetime comparisons and reject or mark incompatible metrics; do not invent cross-channel formulas.

Acceptance/tests: Jan/year boundary, leap year, unequal month lengths, partial month/quarter/year, and 31/32/120/121-day grain boundaries. September 1-23 built-in month comparison uses August 1-23. All dimensions carry identical filter semantics and visible period labels. No migration expected.

### F06c - Apply targets to live analytics results

1. Fetch persisted relevant targets and wire the existing resolution/status helpers into authoritative analytics responses.
2. Resolve campaign > platform > channel > global with the matching evaluation period and effective range. Validate applicability across the entire evaluated period, not only an arbitrary single date.
3. Return target value, rule, scope, period, and neutral status alongside actual values. Do not prorate monthly targets for arbitrary date ranges. Explain when the selected range has no applicable target evaluation.
4. Verify scope validation, permitted updates/end-dating, and overlapping-target rejection through actual database writes. Include concurrent overlapping writes; if integrity requires a migration, follow database-change rules rather than accepting the race.
5. Resolve any ambiguity about simultaneous no-data/no-target status from approved docs before asserting a new ordering rule.

Acceptance/tests: both comparison directions, precedence, no data, no target, period mismatch, effective boundaries, overlap, and non-admin write denial. Dashboard/report outputs carry identical target results.

## F07 - Deliver the dashboard

Dependencies: F06a-F06c. Maps to M07.

Read: M07 plan, dashboard requirements, analytics rules, approved visual references, extracted overview feature.

Steps:

1. Build shared date/period/campaign/channel/platform/KPI controls using backend metadata; reset invalid dependent selections visibly. Use the same filter state/serialisation for dashboard, analytics, and report export.
2. Render channel-aware KPI cards with correct units, currency, labels, target status where applicable, and explanatory unavailable states. Use API values only.
3. Replace the chart placeholder with a real Recharts line chart consuming trend points; provide readable axes, tooltips, gaps, and a table/text alternative. Remove API endpoint descriptions from the user flow.
4. Show useful campaign/channel summaries, counts, and applicable comparisons. Do not create decorative pie charts or a chart builder just to fill space.
5. Provide loading, error/retry, no-records, and filtered-empty states. Keep tables usable on small screens and focus visible. A filtered-out dataset must not be described as never-entered data.

Acceptance/tests: filters change actual queried records and displayed values; null gaps remain distinct from zero; UI uses the correct unit for CPC and percentages; target labels match API; chart is backed by real points. Browser checks desktop/tablet/mobile, keyboard use, empty/error states, and stale-response handling. No migration.

## F08 - Deliver analytics and target administration

Dependencies: F07. Maps to M06/M07. Execute analytics and target forms as separate slices.

Read: analytics/target rules, permissions, extracted overview and targets API.

Steps:

1. Give Analytics a dedicated view consuming F06 trend/comparison responses instead of reusing the overview unchanged.
2. Allow period, campaign, and channel comparisons; show the selected KPI, periods, differences, appropriate units, and unequal-duration notes. Pair charts with a comparison table.
3. Limit metric choices to valid comparable definitions. No global combined CTR or arbitrary ranking of incompatible metrics.
4. Add Administrator create/edit/end-date target forms using approved definitions/scopes/periods. Other roles can view targets and results but cannot change them.
5. Show validation/overlap errors and refresh analytical target status after an authorised mutation.

Acceptance/tests: a user can answer which campaign/channel changed over a selected period using UI alone; target save -> changed dashboard status works; non-admin direct writes fail; missing data and zero baselines are explained. No migration expected.

## F09 - Produce useful PDF reports

Dependencies: F08. Maps to M08.

Read: `docs/analytics/reporting.md`, analytics rules, permissions, API reports service/controller, web Reports view, existing deployment constraints.

Steps:

1. Create one report data assembly path using AnalyticsService responses. Include title, generation timestamp, reporting timezone, exact period, readable active filter labels, KPIs/units, target status, summary counts, relevant comparisons, chart series, and aggregation caveats.
2. Replace the hand-built single-page PDF with a maintained server-side PDF library compatible with the current runtime. This is the preferred bounded implementation choice because it avoids a new production browser runtime. Record renderer/deployment tradeoffs in an ADR; if a headless browser is demonstrably necessary, document the dependency before choosing it.
3. Render a selected trend/comparison chart from report data; render approved fonts/currency symbols, wrapped labels, tables, and pagination. Renderer code may lay out data but must not calculate alternate KPIs.
4. Make preview and download use the same filters and accurately describe actual report content. Show missing-data reports clearly; remove unsupported preview promises.
5. Retain authenticated export for all permitted roles, safe filenames, correct MIME type, bounded request inputs, and temporary-resource cleanup if used. Do not add a Reports persistence table or public share links.

Acceptance/tests: inspect extracted PDF text for timestamp/filter labels/KPI values/units, assert pagination with long content, verify selected chart data, test unavailable values, non-ASCII labels/currency, denied anonymous download, and dashboard/report parity. Browser download test plus visual inspection of a sample PDF. No migration.

## F10 - Finish archival, audit, and security hardening

Dependencies: F09. Maps to M09/M10.

Read: M09/M10 plans, `docs/operations/security.md`, permissions, auth/guards, existing AuditLog writes and schema. Use the security skill.

Steps:

1. Build a route/action matrix for actual endpoints, including imports, targets, account actions, catalogue changes, and reports. Test unauthenticated, permitted, and forbidden callers with real HTTP/session/CSRF paths.
2. Finish approved high-value audit events and correction/archive behaviour. Preserve historical attribution; verify atomicity of mutation and its required audit entry. Do not add a general audit analytics product.
3. Verify unsafe requests require approved origin/token protections; test allowed/disallowed CORS origins, cookie flags, expiry/revocation, login throttling, and safe error output. Do not turn off protections for test convenience.
4. Verify input enums, unknown fields, invalid identifiers, dates, duplicate records, and target conflicts through endpoint validation. Check no sensitive fields appear in any new read/lookup response.
5. Implement approved session cleanup through a local maintenance command or existing in-process mechanism if missing. No Redis or queue.

Acceptance/tests: complete allow/deny matrix including no mutation on denied requests; historical references remain readable; archived records are excluded correctly; required audit writes contain no credentials. Record any undefined audit/profile policy as a narrow blocker. No schema change expected unless approved audit coverage requires one.

## F11 - End-to-end, usability, accessibility, and realistic performance evidence

Dependencies: F10. Maps to M11.

Read: M11 plan, test strategy, current browser/load tests, calculation fixtures, academic evidence checklist.

Steps:

1. Automate Admin creates user/catalogue/target -> Marketing Officer creates campaign and enters/corrects data -> dashboard filters/trend/comparison -> Management reads and exports PDF -> Admin archives -> analytics excludes archived data.
2. Retain regression coverage for CSV/JSON/XLSX preview, mapping, validation, confirmation, provenance, and duplicate/conflict handling. Do not silently replace manual-entry tests with imports.
3. Verify keyboard navigation, focus, labels/error associations, contrast, responsive tables, chart alternatives, and loading/error/empty states. Add a project-local accessibility tool if useful; record manual and automated results separately.
4. Prepare realistic general-marketing usability tasks and a results template. Actual stakeholder/user observations must come from real participants; an agent walkthrough is not user testing. Record participant availability as a remaining dependency if needed.
5. Extend k6 to 25 authenticated concurrent users with dashboard/filtered analytics/campaign/performance reads and a small isolated write workload. Test PDF separately. Specify dataset size, duration, warm-up, thresholds, and safety stop conditions before running. Use approved performance requirements where stated; otherwise label chosen thresholds as local evaluation targets, not stakeholder SLAs.
6. Record environment, p50/p95, error rate, counts, skipped tests, and limitations. Never claim the health-only script establishes application capacity.

Acceptance: critical journeys have no credential skips in the acceptance run; golden calculations and HTTP authorisation matrix pass; accessibility findings are addressed or recorded; realistic load baseline and honest usability status are documented. No production data or external load targets.

## F12 - Documentation, demonstration, and deployment readiness

Dependencies: F11; external deployment can remain blocked independently. Maps to M12.

Read: M12 plan, deployment/security docs, user/developer/local operations guides, academic evidence checklist, completion matrix.

Steps:

1. Update guides for actual manual entry, imports, filtering, targets, comparisons, and export. Use general marketing examples, retaining provenance of the original project brief.
2. Prepare deterministic non-sensitive demo data and a repeatable demo script for all three roles. Keep demo credentials out of documents, screenshots, source, and logs.
3. Reconcile ERD/architecture/use-case/workflow documentation with approved implementation; update only actual approved changes. Add missing screenshots, calculation examples, test results, and acceptance evidence. A checklist of deliverables is not the deliverables themselves.
4. Verify backup/restore on an isolated test target, migration/seed instructions, configuration placeholders, startup/health checks, and recovery instructions. Never restore over the current development database.
5. Prepare the deployment runbook with HTTPS, dedicated database user, origins/cookies, secret configuration, migration/seed order, backup and rollback steps. Do not choose/pay for a host or publish externally without authorisation.
6. Mark local readiness separately from external deployment and actual human usability evidence. Run final safe release checks and update the milestone acceptance matrix and progress record.

Acceptance: a new developer can follow local setup and demonstrate the complete core flow; required local evidence exists and is linked. M12 is not marked externally deployed without a successful authorised deployment. Migrations: none expected.

## Final product acceptance

- [ ] General-purpose positioning is preserved without education-specific domain scope.
- [ ] Admin, Marketing Officer, and Management can complete their permitted workflows.
- [ ] Manual entry, imports, editing, and archival preserve integrity and provenance.
- [ ] Summary, chart, comparison, target, and PDF results use the same approved backend semantics.
- [ ] No nonfunctional primary action or decorative placeholder is presented as an implemented feature.
- [ ] Runtime verification, human evaluation, and external deployment statuses are reported separately and accurately.
