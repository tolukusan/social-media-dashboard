# Design Amendments v1.1

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Design Amendments  
**Version:** 1.1  
**Status:** Approved  
**Phase:** Step 6.5 — Benchmark Validation Amendments  
**Applies to:** Approved Steps 1–6 v1.0

## 1. Purpose

This file records the small set of design amendments identified during the Step 6.5 benchmark review of comparable marketing analytics and reporting systems.

The approved Step 1–6 documents remain valid.

This document does **not** replace those files.

It only adds or supersedes the specific points listed below.

### Precedence Rule

If an approved v1.0 document conflicts with a statement in this file:

**this v1.1 amendment takes precedence.**

If there is no conflict, the original approved document remains authoritative.

---

# 2. Amendment A-001 — Metric Aggregation Metadata

## Applies To

- Step 2: `docs/architecture/domain-model.md`
- Step 2: `docs/architecture/erd.md`
- Step 4: `docs/analytics/kpi-catalog.md`

## Amendment

`MetricDefinition` shall include an aggregation strategy describing how the metric behaves when multiple records are combined.

Logical field:

```text
aggregationStrategy
```

Initial supported values:

```text
SUM
WEIGHTED_AVERAGE
FIRST
LAST
DERIVED
```

Examples:

```text
Impressions          → SUM
Clicks               → SUM
Spend                → SUM
Average Search Position → WEIGHTED_AVERAGE
CTR                  → DERIVED
Engagement Rate      → DERIVED
```

For weighted metrics, the KPI catalogue shall continue to define the required weighting metric.

### Purpose

Aggregation behaviour becomes explicit metric metadata instead of existing only as scattered application logic.

### Scope Impact

None.

This does not introduce user-defined formulas or arbitrary metric creation.

---

# 3. Amendment A-002 — Future DataSource / IntegrationConnection Boundary

## Applies To

- Step 2: `docs/architecture/domain-model.md`
- Step 5: `docs/architecture/architecture.md`

## Amendment

The MVP continues to use:

```text
MarketingChannel
    ↓
Platform
```

No integration-account entity is required in the MVP.

However, future live integrations shall introduce a separate concept representing a concrete connected account or external data source:

```text
MarketingChannel
    ↓
Platform
    ↓
DataSource / IntegrationConnection
```

Example:

```text
Social Media
    ↓
Meta Ads
    ↓
Publishing Company Ad Account
```

A future DataSource may contain information such as:

```text
id
platformId
displayName
externalAccountId
sourceTimezone
status
credentialReference
lastSyncAt
```

Credentials must not be stored as casual plaintext application fields.

### Important Rule

Do not attach third-party account credentials directly to `Platform`.

One Platform may eventually have multiple connected accounts.

### Scope Impact

None for MVP.

This is an architectural extension seam only.

---

# 4. Amendment A-003 — Structured Spreadsheet / CSV Import

## Applies To

- Step 1: `docs/product/scope.md`
- Step 5: `docs/architecture/architecture.md`
- future implementation roadmap

## Amendment

Add the following as an **OPTIONAL / FUTURE** data-ingestion capability:

```text
Structured CSV import
Spreadsheet import
```

The intended evolution is:

```text
MVP
Manual structured form entry
        ↓
Future enhancement
CSV / spreadsheet import
        ↓
Future enhancement
Live API integrations
```

### Important Rule

CSV/spreadsheet import is **not part of the required MVP** and must not delay completion of the core system.

### Scope Impact

None for MVP.

---

# 5. Amendment A-004 — Future Data Source Timezone

## Applies To

- Step 5: `docs/architecture/architecture.md`
- future integration design

## Amendment

The MVP shall continue to use one configured deployment reporting timezone.

When `DataSource / IntegrationConnection` is introduced in a future integration phase, each source may additionally contain:

```text
sourceTimezone
```

This allows imported data from external systems operating in different timezones to be normalised before analytics aggregation.

### Scope Impact

None for MVP.

---

# 6. Explicitly Unchanged Decisions

The Step 6.5 benchmark review does **not** alter the following approved decisions:

- one organisation per deployment
- manual-first MVP data entry
- daily PerformanceRecord granularity
- multi-channel campaigns
- multi-platform campaigns
- Platform belongs to MarketingChannel
- raw metric values are the analytical source of truth
- derived KPI values are calculated
- aggregate numerator/denominator before calculating rates
- seeded approved metric definitions
- no user-defined formula builder in MVP
- no dashboard builder in MVP
- no report-template builder in MVP
- no scheduled reports in MVP
- no live API integrations in MVP
- no multi-tenant client model in MVP
- Management role remains read-only
- PostgreSQL / Prisma architecture
- NestJS modular monolith
- Next.js frontend
- REST API
- database-backed sessions
- backend-owned analytics and reporting logic

---

# 7. Documents That Remain Unmodified

There is no requirement to regenerate Steps 1–6.

The following approved v1.0 files remain authoritative except for the exact amendments above:

```text
requirements.md
scope.md
open-questions.md
domain-model.md
erd.md
permissions-matrix.md
workflows.md
use-cases.md
kpi-catalog.md
analytics-rules.md
kpi-target-rules.md
architecture.md
tech-stack.md
repo-structure.md
security.md
test-strategy.md
reporting.md
deployment.md
```

---

# 8. Source-of-Truth Rule for Step 7 and Implementation

From Step 7 onward, AI agents shall treat project documentation in this order:

```text
1. Current approved task/milestone plan
2. design-amendments-v1.1.md
3. Approved Steps 1–6 v1.0 documentation
4. Original project brief
```

The amendment file overrides only the specific points it addresses.

It must not be interpreted as permission to reinterpret unrelated approved decisions.

---

# 9. Result

The project design baseline is now:

```text
Steps 1–6 Approved v1.0
        +
Step 6.5 Benchmark Audit
        +
Design Amendments v1.1
```

No large consolidated replacement document is required.

This keeps the documentation modular while ensuring the benchmark findings are part of the authoritative design baseline.
