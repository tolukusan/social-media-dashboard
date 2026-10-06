# Competitive Benchmark Audit

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Competitive Benchmark Audit  
**Version:** 0.1  
**Status:** Draft  
**Phase:** Step 6.5 — Retrospective Benchmark Validation  
**Purpose:** Validate Steps 1–6 against mature marketing analytics/reporting systems without rebuilding approved documentation.

## 1. Why Step 6.5 Exists

The project specification and architecture were developed from the approved academic brief before a structured benchmark review of mature commercial systems.

Rather than regenerate Steps 1–6, this phase performs a retrospective validation:

1. compare approved decisions with established products
2. identify problems those products already solved
3. determine whether our solution already handles the issue
4. distinguish deliberate MVP simplifications from accidental gaps
5. create targeted amendments only where they materially improve the design
6. preserve all approved documents unless a specific amendment is accepted

## 2. Systems Reviewed

The benchmark set is intentionally focused on systems with similar dashboard/reporting problems:

- Databox
- Whatagraph
- AgencyAnalytics
- DashThis
- HubSpot Marketing Analytics

Official product/help documentation was used for the review.

## 3. Benchmark Dimensions

The systems were compared against our project in these areas:

- data-source organisation
- metric definitions
- custom/calculated metrics
- aggregation semantics
- KPI targets and favorable direction
- date filtering and period comparison
- dashboards and widgets
- report generation
- report/dashboard templates
- user/client scoping
- custom/manual data ingestion
- scheduled/automated reporting
- permissions and read-only stakeholders

---

# 4. Findings

## B-001 — Centralised Cross-Channel Analytics

### Industry Pattern

All reviewed systems centralise metrics from multiple marketing sources/channels into dashboards and reports.

### Our Current Design

Already aligned:

```text
Campaign
  → Channel
  → Platform
  → PerformanceRecord
  → Metric values
  → Analytics
  → Dashboard / Report
```

### Decision

**KEEP. No amendment required.**

---

## B-002 — Metric Definitions Should Be First-Class

### Industry Pattern

Databox, Whatagraph and AgencyAnalytics treat metrics as first-class reusable definitions rather than only hard-coded dashboard fields.

### Our Current Design

Already aligned through:

- MetricDefinition
- ChannelMetric
- PerformanceMetricValue
- KpiDefinition

### Decision

**KEEP.**

This validates the flexible metric/value model selected in Step 2.

---

## B-003 — Aggregation Semantics Matter

### Industry Pattern

Whatagraph explicitly distinguishes aggregation methods and calculation levels. Mature tools acknowledge that Sum, Average, First, Last and aggregate-level calculations produce different meanings.

### Our Current Design

Step 4 already defines:

- SUM metrics
- weighted Average Search Position
- aggregate-before-divide rate calculations
- special cautions for Reach/Users
- missing versus zero semantics

### Gap

The semantics currently live primarily in documentation/application logic rather than in a reusable metric metadata model.

### Recommendation

**TARGETED AMENDMENT A-001**

Preserve the MVP formula catalogue, but allow MetricDefinition to carry an approved aggregation strategy metadata value, for example:

```text
SUM
WEIGHTED_AVERAGE
FIRST
LAST
DERIVED
```

This does not create custom formulas. It makes the seeded metric catalogue self-describing and reduces hard-coded branching.

---

## B-004 — Custom Metrics and Formula Builders Are Common

### Industry Pattern

Databox, Whatagraph and AgencyAnalytics allow users to create custom/calculated metrics from existing metrics and mathematical operators.

### Our Current Design

The MVP intentionally seeds approved metrics and prevents arbitrary formula creation.

### Decision

**KEEP MVP RESTRICTION.**

Reason:

- academic scope
- prevents uncontrolled formula semantics
- easier validation/testing
- approved project brief only requires selected documented KPIs

### Future Extension Seam

MetricDefinition must remain extensible enough that a future FormulaDefinition or expression model can be introduced without redesigning PerformanceRecord storage.

**No MVP formula builder.**

---

## B-005 — Favorable Direction Is Explicit

### Industry Pattern

AgencyAnalytics, Databox and Whatagraph let metric/KPI configuration specify whether increasing or decreasing values are favorable.

### Our Current Design

Already aligned through:

- HIGHER_IS_BETTER
- LOWER_IS_BETTER
- neutral target statuses
- explicit target comparison rules

### Decision

**KEEP. No amendment required.**

---

## B-006 — KPI Targets Are Filtered/Scoped

### Industry Pattern

Mature systems allow KPIs/goals to target a metric within a particular account/client/filter context.

### Our Current Design

Already supports:

- GLOBAL
- CHANNEL
- PLATFORM
- CAMPAIGN

with precedence:

```text
CAMPAIGN > PLATFORM > CHANNEL > GLOBAL
```

### Decision

**KEEP.**

Potential future extension: more flexible dimension filters if the product ever becomes a generic analytics platform.

---

## B-007 — Connected Data Sources Are Separate from Platforms

### Industry Pattern

Commercial systems distinguish a platform/integration type from a concrete connected data source/account.

Example conceptual difference:

```text
Platform: Meta Ads
Connection: Company Ad Account 123
```

### Our Current Design

The MVP has:

```text
MarketingChannel
Platform
```

but no concrete DataSource/Connection entity because live integrations are future scope.

### Risk

When APIs are introduced later, attaching credentials/account identity directly to Platform would be incorrect because one Platform may have multiple accounts/connections.

### Recommendation

**TARGETED AMENDMENT A-002**

Do not implement integration accounts now.

Add a documented future extension boundary:

```text
Platform
  1 → many IntegrationConnection / DataSource
```

Future performance ingestion may optionally reference a DataSource while preserving the current CampaignPlatform model.

This is an architecture seam, not an MVP feature.

---

## B-008 — Custom/Manual Data Import Is a Normal Escape Hatch

### Industry Pattern

Databox, AgencyAnalytics and DashThis support spreadsheet/custom data sources such as Google Sheets, Excel or CSV alongside native integrations.

### Our Current Design

The MVP supports structured manual data entry but not bulk CSV/Sheet import.

### Decision

**KEEP FORM ENTRY AS MVP CORE.**

### Recommendation

**TARGETED AMENDMENT A-003**

Add `CSV/Spreadsheet structured import` to FUTURE/OPTIONAL scope.

This fits the original brief's manual/structured-entry direction and provides a realistic step between manual forms and live APIs.

Do not add it to core MVP milestones unless time permits.

---

## B-009 — Dashboard/Report Templates Are Mature-System Features

### Industry Pattern

Databox, AgencyAnalytics and Whatagraph allow reusable dashboard/report templates.

### Our Current Design

The dashboard is predefined and reports are generated on demand.

### Decision

**KEEP MVP SIMPLE.**

For this project:

- one strong default dashboard is better than a dashboard builder
- one defined report layout is better than a report designer

### Future Extension

Possible future entities:

```text
SavedView
DashboardTemplate
ReportTemplate
```

No MVP implementation required.

---

## B-010 — Dashboards Often Use Widgets

### Industry Pattern

Commercial tools construct dashboards from widgets/cards/charts.

### Our Current Design

The brief already asks for:

- KPI cards
- line charts
- bar charts
- tables
- target indicators

### Decision

**KEEP current visualisation model.**

Implementation should use reusable dashboard components internally without exposing an end-user widget builder.

---

## B-011 — Reports Can Be Live, Saved, Scheduled or PDF Snapshots

### Industry Pattern

AgencyAnalytics and similar systems persist report configurations, schedule reports and provide live links and PDF snapshots.

### Our Current Design

MVP reports are on-demand PDF output and are not persisted as domain records.

### Decision

**KEEP.**

Scheduling and persistent report definitions are explicitly beyond the current scope.

### Future Extension

Potential later model:

```text
ReportTemplate
SavedReport
ReportSchedule
```

---

## B-012 — Multi-Client / Multi-Tenant Organisation

### Industry Pattern

Agency-focused systems commonly organise data per client/account and provide cross-client roll-ups.

### Our Current Design

One educational publishing organisation per deployment.

### Decision

**KEEP intentionally.**

The commercial pattern is not automatically appropriate for this academic MVP.

Future multi-tenancy should be treated as a major product change, not a hidden requirement.

---

## B-013 — Automated Integrations Dominate Commercial Products

### Industry Pattern

Databox, Whatagraph, AgencyAnalytics and DashThis rely heavily on automatic integration ingestion.

### Our Current Design

Manual-first, API-ready.

### Decision

**KEEP.**

The academic brief explicitly allows manual/structured entry and places live API integrations in future scope.

This is a deliberate scope difference, not a deficiency.

---

## B-014 — Date Ranges and Period Comparisons Are Core

### Industry Pattern

Mature dashboards support dynamic date ranges and period comparisons.

### Our Current Design

Already aligned through:

- current month default
- arbitrary filters
- month/quarter/year comparisons
- elapsed-current-period matching
- trend bucketing

### Decision

**KEEP.**

---

## B-015 — Source Timezones Matter

### Industry Pattern

Databox explicitly requires a timezone for calculated metrics when multiple sources may differ.

### Our Current Design

Step 5 already introduces a configurable reporting timezone per deployment.

### Future Risk

Once multiple live integrations exist, individual sources may have different timezones.

### Recommendation

**TARGETED AMENDMENT A-004**

Document future DataSource timezone metadata.

For MVP manual entry, deployment reporting timezone remains sufficient.

---

# 5. Benchmark Outcome

The benchmark does **not** justify regenerating Steps 1–6.

The approved architecture is broadly consistent with mature marketing analytics systems at the level appropriate to this project.

The major differences are deliberate MVP reductions:

- no user-defined formula builder
- no dashboard builder
- no report designer
- no scheduled reports
- no multi-client tenancy
- no live integration accounts
- no automated ingestion

These should remain reductions, not defects.

The benchmark identified four worthwhile targeted amendments:

1. metric aggregation metadata
2. future DataSource / IntegrationConnection boundary
3. future CSV/spreadsheet import
4. future per-data-source timezone metadata

None require rewriting the current domain.

---

# 6. Source Evidence Reviewed

Official material reviewed included:

- Databox: dashboard reporting, custom metrics, templates, Google Sheets/Excel metric builders
- Whatagraph: custom formulas, custom metrics, metric aggregation/calculation levels, goal widgets, source groups
- AgencyAnalytics: dashboards, custom metrics, KPIs, reports, Google Sheets/custom data, roll-up dashboards
- DashThis: integrations, custom data, dashboards, PDF reporting
- HubSpot: marketing analytics, multi-channel dashboard/reporting

This file records design conclusions, not copied product specifications.
