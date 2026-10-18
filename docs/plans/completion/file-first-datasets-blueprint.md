# Implementation blueprint — Marketwise file-first datasets

Status: approved for implementation by the user on 2026-10-18.

Planning baseline: `origin/main` at `8d3a49e6437655fd6fefeed010d8b3629d8b4268`, inspected read-only. The architect process is published in the [linked skill source](https://github.com/CodeWithClinton/architect_skill/blob/main/README.md).

## What we are building

Make uploading and inspecting campaign files the default Marketwise experience. Each successful import produces an independently manageable dataset in one campaign. Preserve its imported table, offer optional date filtering and suitable charts, and allow explicit comparison of two numeric columns and export. Platforms, metric definitions, and KPI targets do not determine which columns can be imported. Existing accounts, registration, approval, authentication, OAuth, provider retention, campaign integrations, and historical data remain supported.

## Language and decisions agreed with the stakeholder

- **Campaign:** an organizational container for datasets. A file import needs no platform or marketing-channel selection.
- **Dataset:** one successful import in one campaign, containing its own rows and columns. A 365-row table remains one dataset with 365 rows. Overlapping dates or columns never cause cross-dataset merging or overwriting.
- **Column:** an original header and original values, with separate label and type metadata. Labels never replace source headers.
- **Replacement:** an atomic update to the contents of the same dataset. Failure leaves its existing contents usable.
- **Compatible comparison:** explicitly selected columns with compatible meanings, units, and observation intervals. Matching names or numeric types do not establish compatibility.

Further approved boundaries:

1. Use additive migration. Historical imports are manageable only when ownership can be established reliably. Preserve ambiguous historical records and existing values; clearly label their management restriction without exposing database terminology or unusable actions.
2. Administrators can import, view, replace, delete, and reimport. Marketing Officers can import, view, replace with confirmation, and reimport; permanent deletion remains Administrator-only. Management is read-only and may view, filter, visualize, compare, and export. Enforce this in the API.
3. Replacement requires a valid, non-empty dataset and cannot serve as a permanent-deletion workaround.
4. Optional comparisons cover two numeric columns from one or two datasets in the same campaign. Use original values. Shared time-series charts require compatible date fields, observation intervals, meanings, and units. Otherwise offer clearly labeled side-by-side views. Viewing data never requires configuring a comparison.
5. One selected worksheet becomes one dataset. Automatically select the only tabular worksheet; otherwise show worksheet names and row counts. Additional worksheets are separate imports. CSV and tabular JSON each supply one dataset per file.
6. Duplicate identity is campaign + exact uploaded-file checksum + selected worksheet. Filenames, overlapping dates, and matching columns are not duplicate signals. Show the existing dataset with View and, when permitted, Replace. Explicit deletion permits a fresh import; stale attempts stay invalid.

## What the existing implementation establishes

| Area                   | Evidence and implication                                                                                                                                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence            | `apps/api/prisma/schema.prisma`: `ImportBatch` and `ImportRow` retain staging/provenance; `PerformanceRecord` requires a campaign-platform and has a unique daily key. Neither is currently a general, independently owned dataset.                                                                                         |
| Import confirmation    | `apps/api/src/imports/imports.service.ts`: requires date/platform/metric mapping, aggregates repeated daily rows, and can add values to a record created by another batch. `importBatchId` on a record is insufficient evidence of exclusive ownership.                                                                     |
| Original information   | `apps/api/src/imports/file-parser.service.ts`: CSV header detection is source-specific, some headers are renamed, values are trimmed/stringified, and object-key storage cannot faithfully preserve duplicate headers. Original file bytes are not retained. Historical reconstruction is limited to surviving information. |
| Analytics/reporting    | `apps/api/src/analytics/analytics.service.ts`, `calculations.ts`, and `reports/reports.service.ts`: current outputs depend on approved metrics and daily campaign-platform records; reports also request the existing comparison pipeline. They cannot directly represent arbitrary imported columns.                       |
| Deletion/concurrency   | `apps/api/src/common/lifecycle.ts` and `archive/deletion.service.ts`: shared transaction locking, deleted daily-key protection, provenance retention, and mapping checks already protect legacy records. Preserve these safeguards.                                                                                         |
| Integration separation | Connected-account analytics have their own provider-specific records, definitions, and retention under ADR-012. Campaign integrations write existing performance records. Neither should write the new file-dataset tables.                                                                                                 |
| Campaign creation      | `campaigns/campaigns.service.ts` currently requires channel/platform selections although the relational model can represent campaigns without them. Removing that requirement needs service/DTO/form changes, not deletion of existing relationships.                                                                       |

## Recommended architecture and trade-offs

Keep the NestJS modular monolith, REST API, Prisma, and the existing PostgreSQL database. Add a small Dataset module. New file imports stop producing catalog-driven `PerformanceRecord` rows. Existing manual/integration data continues through its current path, with a clearly identified historical/advanced entry point where needed. Never combine those outputs into dataset totals.

The dataset boundary requires real persistence changes. Adding arbitrary metrics to the global catalog, encoding every file row as a daily observation, or only renaming import-history cards would retain the current constraints.

Use four small persistence concepts:

| Concept           | Responsibility                                                                                                                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dataset`         | Stable identity, campaign ownership, display name, active content revision, concurrency version, current duplicate identity, and historical management capability.                                                   |
| `DatasetRevision` | Immutable imported contents: selected worksheet, source checksum/name, ordered column schema, parsing interpretation, row count, importer, and import-attempt reference. A dataset exposes one current revision.     |
| `DatasetRow`      | Revision-owned rows, stable ordinal/source-row identity, original positional cell values, and separate typed values needed for filtering/chart queries. Uniqueness is revision + row ordinal, never campaign + date. |
| `ImportTemplate`  | Reusable parsing/type/date choices and column labels matched against source headers. Templates do not require KPI mappings or establish comparison compatibility.                                                    |

Reuse `ImportBatch` as import-attempt metadata and existing upload infrastructure. Add the target dataset, operation, expected version, and terminal/cancellation information needed for the new workflow. Keep legacy batch/row contracts intact. New staging payload is promoted to revision-owned rows; avoid retaining a second permanent copy in staging. Keep a narrow legacy-ownership reference on historical performance records only when a verified transfer is possible.

Column schema can be a validated JSON document on the revision; a separate global column catalog or one database table per upload is unnecessary. Use stable column IDs and ordinals, preserve duplicate/blank headers positionally, and keep editable labels separate. Relational ownership and constraints remain explicit even though cell contents are flexible.

The trade-off is additional dataset tables alongside the existing performance model. This is smaller and safer than rewriting OAuth, provider retention, manual entry, and daily integration ingestion to accommodate arbitrary spreadsheets. Immutable replacement revisions consume storage, but preserve corrections and prevent replacement from becoming permanent deletion. A version-history interface and automatic retention/purge policy are outside this revision.

## Import and lifecycle behavior

### Upload and interpretation

Use the existing CSV, XLSX, and tabular JSON formats and project-local parsing libraries. Keep upload limits, and bound parsed rows/cells and expanded workbook size. Do not add XLS, providers, or other formats.

The new generic table parser must preserve original header text, order, cell values, and distinguish missing, blank, zero, false, and unparseable values. Handle spreadsheet dates, displayed formats, cached formula results, and error cells explicitly; never evaluate formulas. Do not silently overwrite duplicate headers or stringify structured cells into meaningless text. Preserve unsupported cell content as source information and report interpretation limits.

Detect text, numeric, boolean, date/time, and mixed columns conservatively. Preserve exact numeric source representations; typed projections must not introduce precision loss. IDs with leading zeros stay intact. Ambiguous dates/locales remain unparsed until resolved; they do not make the table unusable. A date field is optional. Users can adjust a label or interpretation without changing source cells. No negative-number, daily-grain, campaign-date, or KPI validation is imposed on arbitrary source data.

The ordinary journey is Upload → select/create campaign → inspect preview and confirm → open dataset. Worksheet selection appears only when needed. Type/date overrides and reusable templates are optional details, not mandatory configuration screens.

### Publish and duplicate protection

Parse and validate before publication. Publish rows, revision, active pointer, duplicate identity, attempt completion, and audit event atomically. A failed attempt exposes no partial dataset.

Enforce the active duplicate identity in the database and recheck it transactionally. Use a non-null worksheet identity for CSV/JSON and the selected worksheet identity for XLSX. Serialize legacy-duplicate checks with publication; inventory pre-existing duplicates before adding constraints, preserving conflicting historical data as protected history. Do not silently merge existing duplicates to make an index succeed.

Duplicate results return the existing dataset and its actual capabilities. A protected historical dataset offers View and a plain explanation. It does not offer an unusable Replace action.

### Replace

Stage the candidate independently. Require at least one meaningful data row, a valid table structure, and explicit confirmation showing the dataset and old/new row counts. Header-only, blank, invalid, and zero-row candidates cannot replace data. Arbitrary text-only datasets remain valid; numeric/date columns are not compulsory.

Publication locks the dataset, rechecks current role, campaign state, expected revision/version, duplicate identity, and attempt validity, then switches the active revision in one transaction. The dataset ID remains stable. Other datasets and worksheets remain untouched. Previous contents remain internal and excluded from normal reads. Marketing Officers cannot purge them or invoke permanent deletion through replacement parameters.

Labels/type overrides from an earlier revision transfer only when their source-column identity is unambiguous. Never carry a column's compatibility declaration onto unrelated replacement data. Stale replacements return a conflict requiring review.

### Delete and reimport

Administrator confirmation identifies the exact dataset and includes all its revisions. In one transaction, delete its row payloads, typed projections, dependent dataset content, and any exclusively owned legacy projections; invalidate pending attempts targeting it and retain minimal audit/attempt evidence. For a migrated dataset, also remove surviving legacy source-row copies only where their exclusive ownership was recorded during transfer. Shared batches or other worksheets must not be deleted wholesale. Do not retain deleted source rows under an audit label. Preserve unrelated records and the campaign.

A fresh upload receives a new attempt and dataset identity and can reuse the deleted file/worksheet checksum. Deletion does not reactivate old attempts. Publication always consumes a specific attempt once; replacement always requires its existing target and expected version. Never implement a missing-target upsert that turns a stale replacement into creation.

Keep existing deleted daily-key tombstones and mapping/lease checks for legacy writers. Any removal of exclusively owned legacy daily records preserves that protection. New datasets do not clear or bypass those legacy tombstones; they have an independent ownership path. Provider syncs have no write path into dataset tables and cannot recreate a deleted file dataset.

## Historical migration strategy

1. Add tables and nullable compatibility fields through new migrations. Do not edit applied migrations, reset data, or drop existing tables.
2. Run a read-only inventory of completed batches, selected sheets, stored raw rows, normalized previews, campaign attribution, current metric values, later imports/edits, archives, and integration provenance. Produce counts and reasons for each migration classification.
3. Build historical views from information that actually survives. A legacy batch may span multiple campaigns; partition only when stored attribution proves the campaign. Unresolved entries remain in Historical imports without being assigned to a guessed campaign. Display: “Imported with an earlier version. Some original file details are unavailable.”
4. Permit ownership transfer only with complete evidence of exclusive contribution: known source rows and campaign, no competing batch contributions, no unexplained later edits, no provider ownership, and matching current values. `importBatchId` or timestamps alone are not proof. Mixed, missing, already-deleted, or uncertain cases remain protected. Existing archived state must never become active through migration.
5. For proven transfers, copy surviving table information into a dataset revision, record exact legacy ownership, and suppress its previous performance representation from legacy analytics/exports. Preserve those underlying historical values during migration. This prevents double counting while retaining evidence. Legacy mutation endpoints must respect the transfer boundary instead of creating two writable copies.
6. Protected entries remain viewable with the explanation: “Historical dataset — viewing is available. Replacement and deletion are unavailable because this import shares existing campaign data.” Do not show disabled mutation buttons. Keep the existing historical analytics values accessible in their clearly labeled context, separate from new dataset reports.
7. Make backfill idempotent with deterministic source identifiers, checkpoints, and before/after row/value counts. Use restrictive foreign keys. A failed backfill leaves old records usable. Do not convert uncertain cases merely to increase the migrated count.
8. Account for datasets in campaign archive/restore/delete. Archive suppresses dataset reads without changing their contents; restore reveals only datasets that still exist. Permanent campaign deletion previews include dataset dependencies and require those datasets to be handled explicitly. Deleted dataset audit markers must not permanently prevent later campaign deletion.

Rollout is additive and staged: verify schema/backfill in an isolated database, compare classifications and values, then enable the file-first experience. A rollback must preserve new dataset tables and payloads; reverting the UI is not permission to drop new data or reactivate suppressed legacy copies indiscriminately.

## Viewing, charts, comparisons, and exports

- Campaign detail lists its datasets with name, source file/worksheet, row count, import date, and plain management status. Open a dataset directly into its rows and original columns. Keep server pagination and stable row ordering.
- Dataset controls select its own date field, date range, and numeric column. Missing/invalid typed values remain visible in the table, with interpretation notes; they are not converted to zero or silently dropped from the imported dataset.
- Charts are optional. Plot source observations without daily merging, resampling, averaging, cumulative summation, invented rates, or KPI targets. Repeated/ambiguous time points use a representation that does not imply an aggregate.
- Comparison accepts exactly two selected numeric columns within one campaign. Shared time-series eligibility is enforced by the backend using selected dates, meaning/unit confirmation, and observation-interval compatibility. Never infer equivalence from headers or spacing alone. Unknown compatibility falls back to labeled side-by-side tables/charts with independent axes and source dates; no automatic join or filling of gaps.
- Add one backend dataset-query path reused by rows, charts, comparison, and reports. UI code renders results; it does not invent authoritative calculations.
- CSV export includes all rows in the selected scope, not only the visible page. Safely encode headers/cells and neutralize spreadsheet formula injection without changing stored source values. PDF export uses the same dataset/revision/filter scope and identifies labels, source, and any selected chart/comparison. Reuse PDFKit; do not introduce a report builder.
- Reports never automatically total columns across datasets or mix file datasets with connected-account analytics. Default campaign reporting first selects datasets; multiple datasets remain separate sections unless the user explicitly opens the approved two-column comparison.
- Replacement/deletion invalidates dataset, campaign, comparison, and report caches. Export endpoints validate current dataset state/revision; stale report requests must refresh or fail safely. Requests after deletion cannot read retained replacement history. A persisted version-history/report artifact system is outside scope.

## What is hidden, changed, or added

| Category                         | Work                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hide from the default experience | KPI Targets, existing period comparisons, campaign/channel comparison screens, mandatory catalog mapping, and global platform/metric filters. Preserve their data and legacy service behavior where needed; old links must lead to a meaningful destination rather than a broken screen.                                                       |
| Frontend changes                 | File-first Overview with campaign/dataset lists and upload actions; campaign dataset lists; source table viewer; optional local date/chart controls; simple comparison; templates; duplicate View/Replace flow; replacement/deletion confirmation; understandable historical restrictions. Retain six primary sections and browser navigation. |
| Backend/schema changes           | Dataset ownership/revisions/rows/templates, generic parsing and type metadata, bounded dataset queries, transactional publication/replacement/deletion, duplicate constraints, attempt invalidation, conservative historical ownership transfer, dataset exports, and campaign lifecycle dependency handling.                                  |
| Preserve                         | Registration/approval/invitations, seeded Administrator/accounts/roles, session/CSRF controls, OAuth/provider permissions and retention, connected-account reports, campaign integrations, unrelated manual/historical records, and existing tables.                                                                                           |

## Phased implementation

### Phase 1 — Dataset foundation and imports

Affected: `apps/api/prisma/schema.prisma`, new migrations, `apps/api/src/datasets/` module and parser, `imports/` attempt infrastructure, `campaigns/` DTO/services, `app.module.ts`, and `packages/shared/src/` contracts.

Implement additive ownership/revisions/rows/templates, generic preserved-cell parsing, campaign selection without platform prerequisites, worksheet selection metadata, conservative typing, publication, and duplicate responses. Keep the tested legacy parser/service contract available to historical paths.

Acceptance: a 365-row file creates one 365-row dataset; overlapping files remain separate; arbitrary columns and repeated dates survive; one populated worksheet auto-selects; no catalog or date field is required; the same file can be imported in another campaign or as another selected worksheet.

Tests: parser golden cases for UTF-8/UTF-16/preambles, duplicate/blank headers, JSON union columns, zero/blank/null/false, negatives/precision/leading-zero IDs, mixed types, ambiguous dates, XLSX date/formula/error cells, malformed/oversized input, and empty tables. PostgreSQL tests cover ownership, foreign keys, concurrent duplicate publication, idempotent confirmation, rollback, and role enforcement.

### Phase 2 — Safe management lifecycle

Affected: dataset lifecycle/controllers, import attempts, `common/lifecycle.ts` integration points, audit handling, and API capability contracts.

Implement View, atomic Replace, Administrator Delete, fresh Reimport, version checks, confirmation, invalidation, and exact ownership-scoped cleanup. Preserve previous replacement revisions internally. Recheck authority at mutation commit, including role changes during a staged import.

Acceptance: failed/empty replacement leaves the old dataset intact; one dataset's mutation never affects a sibling; Management cannot write; Marketing Officers cannot permanently delete through any endpoint or replacement option; deletion removes all dataset contents from new reads/exports while retaining minimal audit evidence; fresh reimport succeeds and stale work fails.

Tests: all roles via direct HTTP, CSRF/origin, role revocation, concurrent replacements, replace/delete races, stale/consumed attempts, duplicate replacement conflicts, audit failure rollback, non-empty enforcement, reimport after deletion, and captured background writes. Verify existing integration tombstone behavior remains intact.

### Phase 3 — Historical compatibility and migration

Affected: migration/backfill tooling, historical import adapters, narrow legacy ownership references, `analytics/`, `performance/`, `archive/`, and historical report eligibility.

Implement the inventory/classification and idempotent migration above. Transfer only provable ownership; retain protected historical entries. Include dataset dependencies in campaign lifecycle operations.

Acceptance: existing source/value counts remain reconciled; shared or edited records are never reassigned by assumption; a proven transfer is not counted twice; replacing/deleting a transferred dataset affects only its verified legacy representation; archived/deleted history is not resurrected.

Tests: migration fixtures for merged imports, manual/provider values, multi-campaign batches, partial imports, missing source details, archived/deleted records, pre-existing duplicates, interrupted/repeated backfill, and identical before/after values for protected history. Test legacy endpoint mutation fences and campaign archive/restore/delete dependencies.

### Phase 4 — File-first UI

Affected: `workspace-shell.tsx`, `workspace-navigation.tsx`, `features/imports/`, `features/campaigns/`, new `features/datasets/`, `features/dashboard/overview.tsx`, `lib/api-client.ts`, shared types, and focused styles.

Replace the default import/catalog workflow and Overview with the approved dataset journey. Add tables, worksheet choice, optional interpretation/templates, duplicate actions, management confirmations, and historical explanations. Remove KPI/complex comparison controls from the default path. Preserve URLs, Back/Forward, mobile access, and unsaved-upload protection.

Acceptance: users can upload, choose/create a campaign, and inspect rows without metric mapping or chart setup. Capabilities match backend permissions. Historical restrictions use plain language; unavailable actions are absent. Empty campaigns offer Upload rather than provider setup prerequisites.

Tests: browser journeys for CSV/XLSX/JSON, multi-sheet selection, 365 rows with pagination, independent overlaps, labels/templates, duplicate View/Replace, non-empty replacement failures, Administrator deletion and fresh reimport, protected history, keyboard/dialog focus, responsive tables, and browser navigation.

### Phase 5 — Optional visualization, comparison, and export

Affected: dataset query/compatibility services, `features/analytics/charts.tsx` reusable rendering, new dataset comparison UI, `reports/` dataset composition/PDF rendering, and `features/reports/`.

Implement the shared dataset query contract, conservative chart eligibility, two-column comparison, full-scope CSV, and scoped PDF. Preserve existing connected-account exports and their provider semantics.

Acceptance: plotted/exported values match original rows; duplicate dates are not aggregated; unknown/incompatible meanings, units, or intervals get side-by-side views; no calculated KPI/rate/totals appear automatically; filters and full export scope agree; deletion/replacement makes stale exports refresh safely.

Tests: golden original-value chart/export parity, mixed/unknown units, daily versus cumulative data, repeated/missing dates, multiple observations per interval, null versus zero, cross-campaign rejection, report pagination, CSV formula safety, and replacement/deletion during comparison/report generation.

### Phase 6 — Regression and rollout readiness

Affected: repository verification, existing and new E2E journeys, deployment/user guidance, domain/permissions documentation, and one focused architecture decision record.

Run formatting/lint, typecheck, API/web builds, complete unit/integration suites in the isolated PostgreSQL database, and the complete Playwright suite. Reconcile old tests with intentional default-UI changes while retaining authorization, OAuth callbacks, synchronization, retention, registration, invitations, Archive, and export assertions.

Record migration inventory, test evidence, rollback procedure, and any genuinely unprovable historical cases. No production database reset or destructive deployment step is part of this plan. Implementation follows this approved phased plan; destructive production data changes require separate explicit review.

## Assumptions and scope limits

- Existing supported formats and file-size boundary remain; parser safeguards may reject structurally unsafe files with clear errors.
- A dataset is campaign-owned organizational data, not privately owned by its uploader. Existing role-based access remains.
- Existing campaign metadata remains available, but platform selection is optional and campaign dates do not truncate arbitrary imported tables.
- Column/date interpretation, units, and compatibility are optional metadata; they do not become a new global metric catalog or formula system.
- Prior replacement contents are internal evidence, not a new version-history feature. Administrator dataset deletion removes those contents too.
- Historical ownership cannot be guaranteed by schema alone; conservative classification is part of acceptance, and protected cases are an approved outcome.
- No new providers, AI analysis, subscriptions, multi-tenancy, semantic deduplication, automatic aggregation, infrastructure services, or unrelated rewrites.

No unresolved product decision currently blocks this bounded blueprint. Detailed DTO names, parsing helper structure, and SQL indexes remain implementation choices constrained by the acceptance criteria above.
