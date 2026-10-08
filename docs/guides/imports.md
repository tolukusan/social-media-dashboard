# Structured Import Workflow

The importer is a deterministic, two-phase workflow for CSV, JSON, and XLSX files.
Legacy `.xls` files are intentionally deferred because the selected workbook parser is XLSX-focused.
Open older Excel exports in Excel or LibreOffice and save a copy as XLSX or CSV before uploading. Renaming the extension does not convert a file. Files must be 10 MB or smaller; export a smaller date range when necessary.

The import step links jump to upload, preview, mapping, and validation as each section becomes available. If you change the configuration after validation, validate again before confirming so the reviewed result matches the settings that will be imported.

## Flow

```text
upload
  → parse and stage ImportBatch/ImportRow records
  → preview columns and sample rows
  → map source columns and campaign/platform context
  → validate rows and detect conflicts
  → explicitly confirm
  → transactionally normalize accepted rows
  → mark ImportBatch COMPLETED
```

`PerformanceRecord.importBatchId` provides batch-level provenance. Manual records retain a null import batch.

## Endpoints

- `POST /api/v1/imports/preview` — multipart upload and staging
- `POST /api/v1/imports/:id/map` — mapping, context resolution, and validation
- `POST /api/v1/imports/:id/confirm` — atomic normalization
- `GET /api/v1/imports` — import history
- `GET /api/v1/imports/:id` — batch details
- `GET /api/v1/imports/:id/rows` — row-level validation details

The preview includes an explicit source row number separate from imported source
columns. Email previews also return distinct values from a mapped `Campaign name`
column so each source campaign can be mapped to its own existing application
campaign through `campaignMappings`.

Email exports may provide `Sent time` as a named month/date timestamp; validation
normalizes that value to the required calendar `recordDate`.

Some Meta CSV exports place the metric name in a preamble line and use a generic
column such as `Primary` for the numeric values. The parser promotes the
non-generic preamble title to the metric column name, preserving the metric
identity for mapping (for example, `Facebook follows` becomes the source metric
that maps to `Followers Gained`).

## Raw, prepared, and canonical layers

`ImportRow.rawData` retains original worksheet column names and values. The
mapping request is the controlled preparation layer: it assigns roles, excludes
source-only fields, selects a calendar key, and maps only approved raw metrics.
Confirmation writes accepted values into the canonical
`PerformanceRecord`/`PerformanceMetricValue` model. Source-derived rates remain
provenance and are not imported as canonical KPI values.

Imports can be named independently of their original filename. The original
filename and checksum remain available for provenance and duplicate-file checks.

Validation supports explicit dataset actions:

- `CREATE` creates a new campaign/platform/date dataset and rejects existing
  record collisions.
- `APPEND` adds additional rows and rejects rows whose campaign/platform/date
  already exists.
- `MERGE` matches by campaign, platform, and calendar record date. New metrics
  are added transactionally; equal existing values are unchanged; differing
  existing values are conflicts.

Completed imports with the same normalized header signature provide a
deterministic, reviewable previous mapping suggestion. Applying it still
requires normal validation and confirmation.

The Email seed includes a provider-neutral `Email / Generic Email Platform` in
addition to intentionally configured named providers. Mailchimp is not seeded as
the normal active Email choice. Imports do not force a provider.

Before row-level validation runs, the import service resolves required global
context: an active platform, campaign or complete source-campaign mappings, a
record-date mapping, and a valid dataset action. A missing platform therefore
returns one actionable context error (for example, `Select an Email platform
before validating this import`) instead of repeating metric-applicability
errors for every row.

Administrators maintain the channel/platform catalogue through the Channels &
Platforms settings screen. Platforms are associated with one channel and are
soft-deactivated/reactivated, so historical campaign and performance links are
preserved. Campaign creation and import selection use active catalogue entries.

Import writes are allowed for `ADMIN` and `MARKETING_OFFICER`; `MANAGEMENT` is denied by backend RBAC.

## Semantics

- Empty or absent source values do not create metric-value rows.
- Explicit zero remains numeric zero.
- Derived rates are not import destinations.
- Source percentages are not canonical KPI values.
- CREATE/APPEND collisions are conflicts and are never silently overwritten; MERGE permits new metrics, treats equal values as no-ops, and flags differing values.
- Archived records continue to occupy the existing campaign-platform/date key.
- A completed file checksum blocks repeated import.
- When an import contains multiple rows for the same campaign, platform, and
  calendar date, the rows are aggregated into one canonical daily row. Raw
  numeric metrics are summed, later source rows retain merge warnings and
  provenance, and only the canonical row is written to `PerformanceRecord`.
- Facebook/Instagram views, viewers, and visits use distinct canonical raw metrics rather than being silently equated to impressions/reach.

Source aliases live in `apps/api/src/imports/source-aliases.ts`. The parser and source mapping layers are separate from analytics calculations so future AI suggestions can feed the same mapping DTO without changing normalization.
