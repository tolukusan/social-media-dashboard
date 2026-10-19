# Marketwise control clarity and campaign data verification

Date: 2026-10-19

## Delivered

- Standardized visible boundaries, labels, helper text, keyboard focus, disabled states, and pending/save feedback for common fields and actions.
- Improved dataset column-detail editing: saved row count, dirty/saved/failed states, a visible save action, preserved values after failed saves, and disabled fields during an in-flight save.
- Added an on-demand campaign data workspace. Removed the empty Channels and Platforms summary tiles from campaign detail.
- Labeled imported-row charts with source-row and metric axes, a legend, and metric-aware tooltips. Hide the trend values panel when all values are unavailable.
- Added a client-side joined-by-date table for separately imported datasets with different columns. It preserves each source dataset and can export the combined view to CSV for a normal import if a persistent combined dataset is needed.
- Improved campaign edit save feedback and added dirty-state behavior to reporting settings and profile editing.

## Verification

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test:unit` — passed, 27 files and 114 tests.
- `pnpm build` — passed.
- Focused `guided-ux` browser coverage — passed for import/join, saved and failed column edits, campaign data disclosure, read-only permissions, chart labels, keyboard focus, and narrow-screen overflow.
- `pnpm test:e2e` — passed, all 23 browser journeys, using the isolated `smd_test_43ac9fd3b272` database. The runner stopped its temporary API and web servers.
- `pnpm test:integration` — 83 of 84 tests passed; `import preview enforces authentication, role, Origin and CSRF before writes` exceeded its 30-second timeout. It exercises the import-preview path in the separately modified import service; the UI clarity implementation did not change that API service.
- Desktop and mobile browser coverage includes 1440×900 and 390×844 layouts. The full application was not manually screenshot-audited page-by-page at both sizes.

No API contract or database schema changed for this UI work; no migration was created. Existing import changes and local credentials were preserved.

## Campaign viewing follow-up

- Opening a campaign now shows its joined-by-date table directly. Source selectors are collapsed under Configure columns; upload and file editing remain behind Manage campaign files.
- CSV timestamp strings such as `2026-01-01T01:00:00` are recognized through the Date column for joins and chart axes. Other text date keys match exactly without guessing day/month order.
- Source rows are collapsed by default, replacement-file input is hidden, and dataset navigation is available while scrolling and at the bottom.
- Column metadata fields align to the top. Campaign editing uses three columns on wide screens, two below 1100px, and one at 640px or below; description, notes, and actions span the form.
- The earlier full-suite result above predates this follow-up. Follow-up validation uses the focused guided-UX suite, including timestamp exports and default campaign viewing, plus type and formatting checks.
- Follow-up results: all five guided-UX browser tests passed (15.3 seconds), including the timestamp CSV regression and default campaign table. The isolated runner's production build, typecheck, lint, and changed-code formatting passed. No production build was run against the active development server's output directory.

## Joined-view consolidation

- Removed the duplicate Compare two columns panel from the dataset workspace. The joined view provides the table, a numeric metric chart against all joined dates, CSV download, and Print / Save PDF.
- Chart values use the selected source's typed numeric cells; missing values remain gaps, repeated dates remain separate points, and no totals or rates are calculated.
- Print / Save PDF opens a local printable report containing every joined row and the selected chart. The browser's print dialog provides PDF saving. Headings and values are HTML-escaped; multi-page tables repeat their headers.
- The existing comparison API remains unchanged. This frontend change requires no migration or new dependency.
- Verification: typecheck, lint, isolated production build, and all five guided-UX browser checks passed (27.7 seconds). The joined-view browser case checks the old panel is absent, the date chart renders, the printable table includes all 26 rows across pagination, the chart is present, and Chromium generates valid PDF bytes.

## Release preparation and provider guide

- Independent review identified and resolved CSV formula protection, canonical typed date keys, and campaign-specific join source isolation. Deleted datasets are excluded from join queries.
- Added the detailed provider setup/migration guide with a fresh secret-free Meta use-case screenshot. It distinguishes actual consent/sync evidence from configuration or approval prerequisites.
- Fresh lint and typecheck passed. Unit tests: 27 files / 114 passed.
- Default integration run: 83/84 passed; create-target authorization case exceeded 30 seconds. Full rerun with `pnpm --filter @smd/api test:integration --testTimeout=60000`: 84/84 passed. The earlier import-preview timeout and this different timeout are retained as observations; no application assertion was bypassed or test code changed.
- `SMD_NEXT_DIST_DIR=.next-release-check pnpm build`: passed for shared package, API and web, without replacing the running development output.
- `pnpm format:docs`: passed.

- Full browser verification initially exposed two stale smoke expectations for collapsed source rows, then a real disclosure-state loss during pagination. Tests now explicitly open source rows; the viewer preserves disclosure state while rows load and resets it for another dataset. Final rerun results follow below.

- Final full isolated browser run: 24/24 passed (1.2 minutes), including pagination, filtering, replacement, exports, joined charts/print, and role checks. Its production web build passed. Temporary test servers stopped. Final web typecheck and lint passed. Independent review cleared the disclosure-state fix.
