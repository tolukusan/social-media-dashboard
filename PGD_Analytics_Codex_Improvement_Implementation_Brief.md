# Codex Implementation Brief — PGD Analytics UX + Import Architecture Improvements

## Project

**Digital Marketing Performance Analytics and Monitoring System**

This application originated from an educational-publishing PGD case study, but the **software itself must remain industry-generic**. Do not hardcode educational-publishing terminology into product logic, seed data, labels, workflows, or assumptions.

The current system already has:

- Next.js / React frontend
- NestJS API
- PostgreSQL + Prisma
- authentication and RBAC
- campaigns
- channels
- platforms
- normalized performance storage
- analytics and KPI calculations
- reports
- structured imports for CSV, JSON, XLSX
- `ImportBatch` / `ImportRow`
- import preview, mapping, validation, confirmation, provenance
- deterministic source adapters
- duplicate-file detection

The current normalized analytics model must remain the core destination:

```text
Campaign
  → CampaignChannel
    → CampaignPlatform
      → PerformanceRecord
        → PerformanceMetricValue
          → MetricDefinition
```

Do **not** replace this normalized model with arbitrary dynamic SQL columns.

---

# Goal

Implement the issues found during real manual testing of the application.

The biggest change is to evolve imports from a rigid fixed-column mapper into a **small, controlled “Power Query-lite” data preparation workflow** while preserving the normalized analytics model underneath.

Do not build Excel.

Do not add AI.

Do not add live platform APIs.

Prioritize:

- correctness
- usability
- data integrity
- provenance
- clear user control
- maintainability
- demonstrability for a PGD defence

---

# Confirmed Issues To Implement

## 1. Keep the Product Generic

The academic case study may remain educational publishing in documentation, examples, screenshots, or seeded demo data where appropriate.

However, the actual application should work for any organization doing digital marketing.

Audit UI text, seeded entities, assumptions, and domain labels.

Avoid product logic that assumes:

- publishers
- books
- schools
- educational products
- one specific stakeholder

Generic concepts should remain:

- Campaigns
- Channels
- Platforms
- Performance Data
- Imports
- Analytics
- Reports
- Users

Do not change the academic project title unless necessary.

## 2. Remove Test Fixture Leakage From Normal UI

The application currently exposes a development fixture:

```text
Import Smoke Campaign
```

This is an engineering test artifact and should not appear in the normal user experience.

Implement one safe approach:

- remove it from normal seed data, OR
- clearly isolate it behind a development/test seed path, OR
- replace it with intentional demo/sample data that is clearly labeled as such

Do not remove fixtures required by automated tests without replacing them appropriately.

The production/demo seed should not expose internal names like `smoke`, `test`, `fixture`, `dummy`, or `temp` unless explicitly presented as sample/demo data.

## 3. Fix Campaign Creation

The Campaigns page displays `+ New campaign` controls that do not work, and there are duplicate campaign creation buttons.

Provide one clear primary campaign creation action on the Campaigns page.

Expected flow:

```text
Campaigns
  → + New campaign
  → campaign form
  → enter details
  → select channel(s)
  → select platform(s)
  → save
  → campaign appears in campaign list
```

Reuse the existing backend campaign APIs, validation, RBAC, and relationships.

Do not create a parallel campaign model.

Ensure validation errors are visible and understandable.

## 4. Remove Global “+ New Campaign” From Unrelated Pages

The `+ New campaign` CTA is currently shown on unrelated pages such as Analytics.

Remove the global campaign CTA from pages where campaign creation is not the primary task.

Keep it only where contextually useful:

- Campaigns page
- Import workflow when a required campaign does not exist

Pages such as Overview, Analytics, Reports, and Users should not show it unless there is a strong context-specific reason.

## 5. Allow Campaign Creation Inside Import Flow

Within import campaign selection, provide:

```text
Campaign
[ Select existing campaign ▼ ]

[ + Create new campaign ]
```

Creating the campaign must:

1. preserve the staged import
2. preserve uploaded file state
3. preserve preview
4. preserve column mappings
5. preserve selected sheet
6. preserve detected source/metric context
7. return the user to the same import flow
8. automatically refresh campaign choices
9. optionally select the newly created campaign

A modal/drawer or nested route is acceptable.

Do not discard staged import state.

## 6. Add User-Defined Dataset / Import Names

Allow users to provide a meaningful logical name, for example:

```text
OutLearn Q1 Facebook Performance
January Email Campaign Results
Back-to-School Social Dataset
```

Keep the original filename separately for provenance.

Prefer a model such as:

```text
ImportBatch
- displayName / title
- originalFilename
- ...
```

If a schema change is required, use an additive Prisma migration.

The user should be able to set the name before confirmation.

If safe and simple, allow renaming the logical import later without altering original provenance.

## 7. Do Not Over-Automate Platform Detection

Real Meta files show that some source files are structurally recognizable while the exact platform may be ambiguous.

Example Meta-style files:

```text
row 1: sep=
row 2: metric/source label
row 3: Date | Primary
row 4+: values
```

Examples of source labels:

- `Facebook follows`
- `Content Interactions`
- `Facebook link clicks`
- `Viewers`
- `Views`
- `Visits`

Detect safe facts automatically:

```text
Structure: Meta daily metric export
Metric: Content Interactions
```

Ask the user for ambiguous business context:

```text
Platform:
[ Select existing platform ▼ ]
```

If metadata explicitly says Facebook or Instagram, suggest/preselect the matching platform if configured, but allow the user to change it before validation.

Do not infer:

```text
Views = Impressions
Viewers = Reach
```

Preserve distinct metric meaning.

## 8. Normalize Meta Calendar Dates Without Timezone Shifts

Real source dates can look like:

```text
2026-01-01 1:00:00
```

The application performance grain is a calendar date.

Normalize using the source calendar date portion:

```text
2026-01-01
```

Do not timezone-convert a date-only performance series in a way that can shift it to the previous/next day.

Preview should display `2026-01-01`, not `2026-01-01T01:00:00`.

Add regression tests.

## 9. Make Email Platform Naming Provider-Neutral

Current seeded platform `Mailchimp (Email Marketing)` is too vendor-specific.

The application must not imply Mailchimp is the only Email Marketing provider.

Preferred model:

```text
Channel: Email Marketing

Platforms/providers may include:
- Email / Generic Email Platform
- Mailchimp
- Brevo
- HubSpot
- Klaviyo
- Other
```

At minimum, ensure imports can use a generic Email platform when provider is unknown.

Do not force imported Email data into Mailchimp.

Administrators should continue to be able to manage platforms according to the existing architecture.

## 10. Replace Rigid Import Mapping With a “Power Query-Lite” Model

The current UI maps nearly every source column into a fixed canonical destination.

This is too rigid.

Different sources may use different headers, metadata, naming, grains, and cleanup conventions.

Use three layers:

```text
RAW SOURCE DATA
    ↓
CONTROLLED DATA PREPARATION / TRANSFORMATION
    ↓
CANONICAL ANALYTICS MODEL
```

## 11. Raw Source Layer

Preserve source data faithfully.

Retain:

- original filename
- original worksheet
- original column names
- original row values
- original campaign names
- original metadata
- source row numbers
- import batch
- checksum
- warnings/errors

Do not destructively rename raw source fields.

If an imported workbook contains:

```text
Campaign name
Subject
Sent
Opened
Clicked
Sent time
Delivered
...
```

the raw staged representation should preserve those names.

Renaming for display must be a transformation, not a mutation of original provenance.

Existing `ImportRow.rawData` should be reused where appropriate.

## 12. Controlled Transformation Layer

Implement only a small set of useful data-preparation actions.

Supported actions should include:

### Column actions

- rename display column
- set column role
- set data type where needed
- ignore/exclude from analytics
- map to canonical metric
- identify key column

### Dataset actions

- create a new logical dataset
- add to an existing logical dataset
- append rows
- merge/join columns using shared keys
- preview result before confirmation

Do NOT implement:

- arbitrary formulas
- macros
- pivot-table designer
- spreadsheet cell editing everywhere
- Excel formula language
- arbitrary scripting
- hundreds of transformations

This is a marketing-data preparation workflow, not a spreadsheet clone.

## 13. Introduce a Logical Dataset Concept

The user should be able to think in terms of:

```text
Campaign
  → Platform Dataset
```

Example:

```text
Campaign: OutLearn Launch

Facebook Dataset
- Date
- Views
- Viewers
- Follows
- Content Interactions
- Link Clicks
- Visits
```

The physical database should remain normalized.

A logical dataset may be a view/aggregation concept over:

```text
CampaignPlatform
+ PerformanceRecord
+ PerformanceMetricValue
```

Do not add a physical SQL column each time a new metric arrives.

If a new persistence entity is required for dataset configuration, keep it lightweight and additive.

Before adding a schema model, determine whether the existing `CampaignPlatform` + import metadata can represent the concept cleanly.

## 14. Add New Data to an Existing Dataset

Example existing imported data:

```text
Date         Follows
2026-01-01   2
2026-01-02   1
```

New file:

```text
Date         Content Interactions
2026-01-01   79
2026-01-02   17
```

The user should be able to choose:

```text
What do you want to do?

○ Create new dataset
● Add to existing dataset

Existing dataset:
[ OutLearn Launch → Facebook ]

How should it combine?
○ Append rows
● Merge columns using shared key
```

Then:

```text
Existing key: Date
New key: Date
```

Preview:

```text
Date         Follows   Content Interactions
2026-01-01   2         79
2026-01-02   1         17
```

Internally this should translate to the normalized model:

```text
PerformanceRecord(date)
  + PerformanceMetricValue(FOLLOWS)
  + PerformanceMetricValue(ENGAGEMENTS)
```

Do not create duplicate date fields.

## 15. Shared-Key Detection

When importing a related dataset, detect likely common keys.

Examples:

- Date
- Campaign name
- external record ID

Suggest the key but let the user confirm.

Normalization should compare names in a safe normalized form for suggestion purposes, for example:

```text
Date
date
DATE
```

may be suggested as equivalent.

Do not automatically merge ambiguous fields without confirmation.

Show:

- matched rows
- unmatched existing rows
- unmatched incoming rows
- conflicts

before confirmation.

## 16. Support Merge and Append Semantics

Implement two explicit concepts.

### Append

Use when incoming rows represent additional observations with compatible structure.

Example:

```text
Jan dataset
+
Feb dataset
```

### Merge

Use when incoming data adds additional fields/metrics to observations identified by a shared key.

Example:

```text
Date + Follows
JOIN
Date + Views
```

The UI must make the difference understandable.

Do not silently choose append or merge when ambiguous.

## 17. Preserve Normalized Database Semantics During Merge

The current uniqueness rule is approximately:

```text
CampaignPlatform + recordDate
```

and metric values are unique per:

```text
PerformanceRecord + MetricDefinition
```

Use this existing model.

When a merge adds a metric for an existing date:

- if the metric does not exist, allow safe transactional addition
- if the metric already exists with the same value, treat it as idempotent/no-op or safe duplicate according to existing semantics
- if the metric already exists with a different value, mark a conflict
- never silently overwrite

Preview conflicts before commit.

All writes must remain transactional.

## 18. Multiple Campaign Values in One Source File

Real Email data contains multiple source campaign values in one workbook.

Example values include:

```text
Introducing OutLearn
Introducing OutLearn!!!
Exclusive 6-Month Free Trial Offer of OutLearn
```

Detect unique campaign values.

Provide explicit mapping per source campaign:

```text
Source campaign: Introducing OutLearn
[ Map to existing campaign ▼ ]
[ + Create as new campaign ]

Source campaign: Introducing OutLearn!!!
[ Map to existing campaign ▼ ]
[ + Create as new campaign ]
```

Do not force all source campaign rows into one application campaign.

Do not automatically decide that similar names are the same campaign.

If deterministic similarity detection is simple, it may show a suggestion such as:

```text
Possible match: Introducing OutLearn
```

but the user must confirm.

## 19. Source Column Identity vs Display Name vs Analytics Meaning

A column should conceptually support three identities:

```text
Source name:
Opened

Display name:
Opened

Analytics meaning:
EMAIL_OPENS
```

Another source might contain:

```text
Source name:
Unique opens

Display name:
Unique opens

Analytics meaning:
EMAIL_OPENS
```

This lets:

- source provenance remain intact
- users rename columns for readability
- analytics remain consistent across campaigns/providers

Do not use display labels as the analytics identifier.

Canonical metric codes remain the internal analytics contract.

## 20. Reduce Mapping UI Noise

The current mapping page is extremely long because every source column receives a dropdown.

Redesign the mapping UI so it is easier to review.

Potential approach:

```text
Analytics fields
----------------
Sent       → Emails Sent
Opened     → Email Opens
Clicked    → Email Clicks
Delivered  → Emails Delivered
Bounced    → Bounces

Source-only fields
------------------
Subject
Sender name
Created time
Open rate
Click rate
...

[Show source-only fields]
```

Source-only fields should remain in provenance/staging even when not mapped to analytics.

Do not require the user to manually choose `Ignore column` repeatedly for obviously non-analytical metadata.

Allow review/override.

## 21. Source-Provided Derived Rates

Continue preserving the existing rule:

Canonical derived analytics should be calculated by the application from raw metrics.

Examples:

- open rate
- CTR
- engagement rate
- conversion rate

Source-provided rate columns may be:

- retained in raw source metadata
- optionally displayed
- not treated as the canonical KPI unless explicitly designed otherwise

Do not duplicate formulas in import code.

## 22. Mapping Templates

Add reusable deterministic mapping templates.

Example:

```text
Template:
Meta daily Facebook follows

Date → Record date
Primary → Followers gained
```

Or:

```text
Template:
Generic Email Export

Sent → EMAIL_SENT
Opened → EMAIL_OPENS
Clicked → EMAIL_CLICKS
Delivered → EMAIL_DELIVERED
```

When a later import matches a known structure:

```text
Previous mapping found.

[ Apply mapping ]
[ Review mapping ]
```

Templates should be deterministic and user-reviewable.

Do not add AI.

Store only what is necessary:

- source signature / normalized headers
- source/platform context if appropriate
- column roles
- canonical metric mappings
- key mapping
- optional transformation configuration

If schema persistence is required, use an additive migration.

## 23. Future AI Extension Point Only

Do not add any AI runtime.

Design mapping interfaces so a future AI service could later propose:

- source type
- platform
- campaign matching
- column roles
- metric mappings
- merge key
- anomaly warnings

But future AI suggestions must feed into the same:

```text
mapping DTO
→ validation
→ preview
→ deterministic normalization
```

No AI should bypass validation.

---

# Target Import Flow

```text
1. Upload
   ↓
2. Preview raw data
   ↓
3. Name dataset/import
   ↓
4. Detect safe structure/metric hints
   ↓
5. Choose:
      Create new dataset
      OR
      Add to existing dataset
   ↓
6. Choose/create campaign(s)
   ↓
7. Choose platform/provider
   ↓
8. Configure:
      source columns
      display names
      key(s)
      analytics mappings
   ↓
9. If existing dataset:
      choose Append or Merge
   ↓
10. Preview transformed result
   ↓
11. Validate:
      accepted
      warnings
      unmatched
      conflicts
      rejected
   ↓
12. Confirm
   ↓
13. Transactional normalization
   ↓
14. Analytics / Dashboard / Reports
```

---

# UX Guidance

The app is for marketing/management users, not data engineers.

Avoid technical terminology such as:

- inner join
- left outer join
- schema reconciliation

unless hidden in advanced help.

Prefer:

```text
Add new rows
Add new columns using matching values
Match using: Date
```

---

# Do Not Break Existing Behavior

Preserve:

- authentication
- sessions
- CSRF
- RBAC
- user management
- campaign APIs
- current manual performance API
- normalized metric storage
- duplicate-file detection
- missing vs zero semantics
- import provenance
- archive behavior
- analytics calculations
- reports
- existing tests

Manual records must continue to work.

Existing completed imports must remain readable.

---

# Missing vs Zero Remains Critical

Continue enforcing:

```text
explicit 0 → numeric zero
blank/missing → no metric supplied
```

Merging datasets must preserve this distinction.

Do not infer zero from absence.

---

# Authorization

Continue using backend RBAC.

Expected import roles:

- Administrator: allowed
- Marketing Officer: allowed
- Management: denied

Campaign creation permissions should follow existing campaign RBAC.

Do not rely on frontend hiding.

---

# Tests Required

## Campaign UI

- New Campaign control works
- duplicate global CTA removed
- campaign created through normal Campaigns flow
- campaign created during staged import
- staged import state survives campaign creation

## Meta files

- `sep=` preamble
- metric metadata
- explicit Facebook hint
- ambiguous metric
- user platform confirmation
- source date normalized to calendar date

## Generic Email

- generic Email platform is available
- provider is not forced to Mailchimp
- multiple source campaign values detected
- independent campaign mappings

## Dataset merge

Test:

```text
Date + Follows
merge
Date + Interactions
```

Verify resulting normalized records contain both metrics.

Also test:

- exact matching dates
- unmatched incoming dates
- unmatched existing dates
- same metric same value
- same metric conflicting value
- blank vs zero
- transactional rollback

## Append

Test compatible row append and duplicate/conflicting record behavior.

## Raw preservation

Verify raw source column names and values remain accessible after display rename / canonical mapping.

## Mapping templates

- save template
- detect matching template
- apply template
- override template
- template does not bypass validation

## Existing regression

Run:

- lint
- typecheck
- API tests
- web build
- Playwright
- Prisma migration validation

---

# Implementation Approach

Before modifying code:

1. inspect current import implementation
2. inspect current Prisma schema
3. inspect campaign create APIs
4. inspect current frontend routing/layout
5. determine the minimum additive schema changes
6. avoid unnecessary new entities

Recommended sequence:

1. Fix campaign CTA and create-campaign UI
2. Remove global campaign CTA
3. Isolate smoke/test seed data
4. Make Email provider generic
5. Improve Meta platform confirmation/date preview
6. Add import/dataset display name
7. Refactor source-column representation so raw names remain immutable
8. Introduce transformation configuration
9. Add existing-dataset selection
10. Implement shared-key merge preview
11. Implement append
12. Add multi-campaign source mapping/create flow
13. Add mapping-template persistence
14. Refactor mapping UI to reduce noise
15. Add/expand tests
16. Run complete verification

---

# Database Guidance

Prefer additive changes only.

Do not edit previously applied migrations.

Possible new concepts may include:

```text
ImportMappingTemplate
DatasetConfiguration
ImportTransformation / mapping JSON
```

But do not create these blindly.

First determine whether existing:

- ImportBatch
- ImportRow
- CampaignPlatform
- PerformanceRecord
- PerformanceMetricValue
- AuditLog

can support the behavior with small additions.

If transformation/mapping configuration can safely be persisted as JSON on ImportBatch, that may be simpler than several new tables.

Choose the simplest design that remains maintainable and queryable.

Document the decision.

---

# Documentation

Update `docs/imports.md` or equivalent.

Document:

- raw vs transformed vs canonical layers
- logical dataset concept
- append vs merge
- shared keys
- source/display/canonical column identity
- campaign mapping
- provider-neutral platforms
- mapping templates
- duplicate/conflict behavior
- missing vs zero
- future AI extension point
- known limitations

Keep documentation generic rather than educational-publishing-specific.

---

# Required Final Manual Verification

## Flow A — Campaign creation

```text
Campaigns
→ New campaign
→ create
→ appears in list
```

## Flow B — Create campaign during import

```text
Upload
→ preview
→ required campaign missing
→ create campaign
→ return to staged import
→ state preserved
→ new campaign selectable
```

## Flow C — Facebook dataset merge

Use representative files:

```text
Follows.csv
Interactions.csv
Views.csv
```

Expected:

```text
Create Facebook dataset from first file
→ add second file
→ match Date
→ merge Content Interactions
→ add third file
→ match Date
→ merge Views
```

Verify final logical table appears approximately as:

```text
Date | Follows | Content Interactions | Views
```

Verify database remains normalized metric-value rows.

## Flow D — Multi-campaign Email

Upload an XLSX containing multiple campaign names.

Verify:

- campaigns detected independently
- each can map to existing campaign
- each can create a new campaign
- generic Email platform can be selected
- Mailchimp is not forced
- raw Subject/Sender fields are preserved even if not canonical metrics

## Flow E — Mapping template

Import a similarly structured file twice.

Verify second import can reuse a previous deterministic mapping while still requiring validation.

---

# Final Report Required From Codex

Return:

## A. Investigation Before Changes

Briefly state what existing code/models were reused.

## B. Issues Implemented

Map each item in this brief to the implementation.

## C. UX Changes

Describe new user flows.

## D. Campaign Changes

- new campaign flow
- import-context campaign flow
- CTA cleanup

## E. Import Architecture

Explain:

```text
raw
→ transformed
→ canonical
```

## F. Dataset Merge / Append

Describe exact semantics.

## G. Multi-Campaign Handling

Explain Email behavior.

## H. Platform / Provider Handling

Explain Meta ambiguity and generic Email provider behavior.

## I. Database Changes

List migration names and exact fields/models.

## J. Mapping Templates

Explain storage and matching.

## K. Conflict Rules

State exactly what happens on:

- duplicate file
- existing record
- existing metric same value
- existing metric different value
- unmatched key
- missing value
- explicit zero

## L. Tests

List tests added/updated.

## M. Verification

Provide results for:

- lint
- typecheck
- tests
- build
- Playwright
- migrations

## N. Manual Flows

Report actual manual verification for flows A–E.

## O. Files Changed

List all modified/new files.

## P. Known Limitations

Be explicit.

## Q. Repository Status

Show Git status if available.

If no Git metadata exists, say so clearly.

---

# Explicit Non-Goals

Do NOT implement:

- AI/LLM mapping
- predictive analytics
- live Facebook API
- live Instagram API
- Mailchimp API
- LinkedIn API
- arbitrary spreadsheet formulas
- pivot tables
- macros
- general-purpose spreadsheet editing
- a full Power Query clone
- a full Excel clone
- dynamic physical database columns per import

The system should remain:

**a digital marketing performance analytics application with a strong, controlled data-ingestion workflow.**
