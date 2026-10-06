# KPI and Metric Catalogue

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** KPI and Metric Catalogue  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 4 — KPI & Analytics Semantics  
**Depends on:** Steps 1–3 Approved v1.0

## 1. Purpose

This document defines the approved MVP marketing metrics, their meanings, units, applicability, storage behaviour and derived KPI formulas.

The implementation agent must not invent alternative formulas or silently change metric semantics.

---

# 2. Metric Types

## RAW

A RAW metric is directly entered into the system for a daily PerformanceRecord.

Examples:

- Reach
- Impressions
- Clicks
- Spend

RAW metrics are stored in `PerformanceMetricValue`.

## DERIVED

A DERIVED metric is calculated from approved raw metrics.

Examples:

- CTR
- Engagement Rate
- Conversion Rate
- Cost per Click

DERIVED metrics are not manually entered as the analytical source of truth.

---

# 3. Units

| Unit Code | Meaning |
|---|---|
| COUNT | Whole-number event/person/session count |
| PERCENT | Percentage from 0 upward, normally shown with `%` |
| CURRENCY | Monetary value |
| POSITION | Search-ranking position |
| DECIMAL | General decimal value if needed |

---

# 4. Global Calculation Rules

## KPI-RULE-001 — Raw Source of Truth

Derived metrics shall be calculated from raw stored values.

## KPI-RULE-002 — Aggregate Before Divide

For ratio/rate KPIs, aggregate the numerator and denominator first, then calculate the rate.

Do not average row-level percentages unless a specific KPI explicitly requires it.

## KPI-RULE-003 — Zero Denominator

If the denominator is zero, the derived rate shall return `null` / unavailable rather than `0%`.

Rationale: zero numerator over zero denominator does not represent a measured zero rate.

## KPI-RULE-004 — Missing Data

Missing raw data shall remain missing and shall not automatically be converted to zero.

## KPI-RULE-005 — Rounding

Derived percentages and currency-per-unit metrics shall be calculated with full available precision and rounded to **2 decimal places for display**.

Stored raw values shall not be rounded merely for display purposes.

## KPI-RULE-006 — Archived Records

Archived PerformanceRecords shall be excluded from normal KPI and analytics calculations.

## KPI-RULE-007 — Date Filtering

Only PerformanceRecords whose `recordDate` falls inside the selected period shall contribute to the calculation.

## KPI-RULE-008 — Campaign Filtering

When a campaign filter is active, only records belonging to that campaign contribute.

## KPI-RULE-009 — Channel Filtering

When a channel filter is active, only records under CampaignPlatforms belonging to that channel contribute.

## KPI-RULE-010 — Platform Filtering

When a platform filter is active, only records for that platform contribute.

---

# 5. Social Media Metrics

## SM-REACH — Reach

**Type:** RAW  
**Unit:** COUNT  
**Meaning:** Number of unique people/accounts reached as reported by the source platform.

### Validation

- minimum: 0
- integer-compatible value expected

### Aggregation

**SUM with caution.**

Daily platform reach may contain repeated people across days. Therefore a summed multi-day reach is an additive reporting approximation, not guaranteed unique audience across the whole period.

The UI/report should label it as aggregated reach rather than claiming unique period audience unless the source can provide deduplicated period reach.

---

## SM-IMPRESSIONS — Impressions

**Type:** RAW  
**Unit:** COUNT

### Validation

- minimum: 0

### Aggregation

SUM

---

## SM-ENGAGEMENTS — Engagements

**Type:** RAW  
**Unit:** COUNT

Represents the total engagement count supplied for the daily record.

### Validation

- minimum: 0

### Aggregation

SUM

---

## SM-LINK-CLICKS — Link Clicks

**Type:** RAW  
**Unit:** COUNT

### Validation

- minimum: 0

### Aggregation

SUM

---

## SM-FOLLOWERS-GAINED — Followers Gained

**Type:** RAW  
**Unit:** COUNT

Represents followers gained during the reporting day, not total follower balance.

### Validation

For the MVP this value shall be non-negative.

If follower loss/net follower change becomes required later, introduce a separate net-change metric rather than overloading this field.

### Aggregation

SUM

---

## SM-ENGAGEMENT-RATE — Engagement Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`Engagement Rate = (Total Engagements / Total Reach) × 100`

### Required Raw Metrics

- SM-ENGAGEMENTS
- SM-REACH

### Zero Denominator

If Total Reach = 0 → `null`

### Display Precision

2 decimal places

---

## SM-CTR — Social Click-Through Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`CTR = (Total Link Clicks / Total Impressions) × 100`

### Required Raw Metrics

- SM-LINK-CLICKS
- SM-IMPRESSIONS

### Zero Denominator

If Total Impressions = 0 → `null`

---

# 6. Website / Content Metrics

## WEB-USERS — Users

**Type:** RAW  
**Unit:** COUNT

### Aggregation

SUM with caution.

Daily users may include the same user on multiple days. Therefore summed daily users are not guaranteed unique users over a larger period.

---

## WEB-SESSIONS — Sessions

**Type:** RAW  
**Unit:** COUNT

### Aggregation

SUM

---

## WEB-PAGE-VIEWS — Page Views

**Type:** RAW  
**Unit:** COUNT

### Aggregation

SUM

---

## WEB-CONVERSIONS — Conversions

**Type:** RAW  
**Unit:** COUNT

### Aggregation

SUM

---

## WEB-CONVERSION-RATE — Website Conversion Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`Conversion Rate = (Total Conversions / Total Sessions) × 100`

### Rationale

For website analytics, sessions provide a more stable denominator than clicks because the website record does not require an incoming-click metric in the MVP catalogue.

### Zero Denominator

If Total Sessions = 0 → `null`

---

# 7. Email Marketing Metrics

## EMAIL-SENT — Emails Sent

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## EMAIL-DELIVERED — Emails Delivered

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

### Validation Rule

Delivered should not exceed Sent within the same daily performance context.

---

## EMAIL-OPENS — Opens

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

For the MVP this is the source-reported opens value. The project does not attempt to correct for email privacy mechanisms.

---

## EMAIL-CLICKS — Email Clicks

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## EMAIL-UNSUBSCRIBES — Unsubscribes

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## EMAIL-CONVERSIONS — Email Conversions

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## EMAIL-OPEN-RATE — Open Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`Open Rate = (Total Opens / Total Delivered) × 100`

### Zero Denominator

If Total Delivered = 0 → `null`

---

## EMAIL-CTR — Email Click-Through Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`Email CTR = (Total Email Clicks / Total Delivered) × 100`

### Note

This is click-through rate based on delivered emails, not click-to-open rate.

### Zero Denominator

If Total Delivered = 0 → `null`

---

## EMAIL-CONVERSION-RATE — Email Conversion Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`Conversion Rate = (Total Email Conversions / Total Email Clicks) × 100`

### Zero Denominator

If Total Email Clicks = 0 → `null`

---

# 8. Online Advertising Metrics

## ADS-IMPRESSIONS — Impressions

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## ADS-REACH — Reach

**Type:** RAW  
**Unit:** COUNT

### Aggregation

SUM with the same cross-day uniqueness caution as Social Reach.

---

## ADS-CLICKS — Clicks

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## ADS-SPEND — Spend

**Type:** RAW  
**Unit:** CURRENCY  
**Aggregation:** SUM

### Validation

- minimum: 0
- currency interpretation follows the organisation's configured/display currency

The MVP assumes one operational reporting currency per deployment.

---

## ADS-CONVERSIONS — Conversions

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## ADS-CTR — Advertising CTR

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`CTR = (Total Clicks / Total Impressions) × 100`

### Zero Denominator

If Total Impressions = 0 → `null`

---

## ADS-CPC — Cost per Click

**Type:** DERIVED  
**Unit:** CURRENCY

### Formula

`CPC = Total Spend / Total Clicks`

### Zero Denominator

If Total Clicks = 0 → `null`

---

## ADS-CONVERSION-RATE — Advertising Conversion Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`Conversion Rate = (Total Conversions / Total Clicks) × 100`

### Zero Denominator

If Total Clicks = 0 → `null`

---

# 9. SEO Metrics

## SEO-ORGANIC-TRAFFIC — Organic Traffic

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

The exact source measure should be consistently interpreted by the organisation, preferably organic sessions or organic visits.

---

## SEO-SEARCH-IMPRESSIONS — Search Impressions

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## SEO-SEARCH-CLICKS — Search Clicks

**Type:** RAW  
**Unit:** COUNT  
**Aggregation:** SUM

---

## SEO-AVG-POSITION — Average Search Position

**Type:** RAW  
**Unit:** POSITION

### Aggregation

Do **not** sum.

For multi-day views, use a weighted average when sufficient weighting data is available.

For the MVP, use search impressions as the weight:

`Weighted Position = Σ(Daily Average Position × Daily Search Impressions) / Σ(Daily Search Impressions)`

If total search impressions = 0 → `null`

This is more meaningful than a simple average of daily position values.

---

## SEO-CTR — Search Click-Through Rate

**Type:** DERIVED  
**Unit:** PERCENT

### Formula

`Search CTR = (Total Search Clicks / Total Search Impressions) × 100`

### Zero Denominator

If Total Search Impressions = 0 → `null`

---

# 10. KPI Target Semantics

A KPI Target defines an expected value for an approved KPI.

## Required Target Attributes

- KPI definition
- target value
- period type
- effective-from date
- optional effective-to date
- target scope
- comparison rule

## Supported Period Types

- DAILY
- WEEKLY
- MONTHLY
- QUARTERLY
- YEARLY
- CAMPAIGN

---

# 11. Target Scope

The MVP shall support the following target scopes:

## GLOBAL

Applies across all matching data.

## CHANNEL

Applies to one MarketingChannel.

## PLATFORM

Applies to one Platform.

## CAMPAIGN

Applies to one Campaign.

A target shall use exactly one scope type.

The physical implementation may model this through explicit nullable foreign keys plus a validated `scopeType`, or another design approved during architecture.

---

# 12. Target Comparison Rules

Each KPI target must explicitly define how the actual value is evaluated.

## HIGHER_IS_BETTER

Example:
- CTR target ≥ 3%

Status:
- actual >= target → AT_OR_ABOVE_TARGET
- actual < target → BELOW_TARGET

## LOWER_IS_BETTER

Example:
- CPC target ≤ ₦200

Status:
- actual <= target → AT_OR_BETTER_THAN_TARGET
- actual > target → ABOVE_TARGET

## EXACT_OR_MINIMUM

Not required separately in MVP because it can be represented with HIGHER_IS_BETTER.

## RANGE

Deferred from MVP unless a concrete KPI requires it.

---

# 13. KPI Status Values

For clearer semantics, use neutral target-status wording rather than business-value judgments.

Approved status values:

- NO_TARGET
- NO_DATA
- MEETS_TARGET
- MISSES_TARGET

The UI may display contextual wording such as:

- Meets target
- Below target
- Above cost target

but status calculation must follow the configured comparison rule.

---

# 14. Target Resolution

If multiple targets could apply to the same KPI and date, use the most specific applicable target:

1. Campaign target
2. Platform target
3. Channel target
4. Global target

Within the same scope, the target whose effective date range contains the reporting period is used.

Conflicting overlapping targets of the same KPI, scope and effective period shall be rejected by validation.

---

# 15. Metric Validation Summary

| Metric Family | Key Validation |
|---|---|
| Counts | >= 0 |
| Spend | >= 0 |
| Average Position | > 0 when provided |
| Emails Delivered | <= Emails Sent for same record |
| Derived Rates | never manually entered |
| Daily Date | cannot be future dated |
| Record Date | must fall within campaign dates |

---

# 16. Approved Step 4 Decisions

## KQ-001 — Reporting Currency

**Decision:** One reporting currency shall be configured per deployment.

The currency shall not be hard-coded into the domain model. The deployment configuration shall provide the currency code used to display monetary metrics such as Spend and CPC.

## KQ-002 — Reach/User Aggregation Labelling

**Decision:** Daily Reach and Users may be summed for period-level dashboard/reporting purposes, but period results shall be labelled as **Aggregated Reach** and **Aggregated Users** where there is a risk of implying deduplicated unique audience.

The system must not claim deduplicated period uniqueness unless a source explicitly supplies it.

## KQ-003 — Email Opens Semantics

**Decision:** Accept source-reported opens as entered.

The MVP shall not attempt to correct or normalise opens for privacy-protection mechanisms or infer unique opens.

## KQ-004 — Global KPI Targets

**Decision:** GLOBAL KPI targets are supported in addition to CHANNEL, PLATFORM and CAMPAIGN targets.

## KQ-005 — Target Comparison Granularity

**Decision:** A KPI target is evaluated only against the matching target period type.

Examples:

- DAILY target → day
- MONTHLY target → calendar month
- QUARTERLY target → calendar quarter
- YEARLY target → calendar year
- CAMPAIGN target → campaign-lifetime evaluation

The MVP shall not automatically prorate a monthly target into a daily target or vice versa.

---

# 17. Step 4 Approval Status

**Step 4 is Approved v1.0.**

Approved analytics semantics include:

- raw metrics are the analytical source of truth
- derived KPIs are calculated from raw values
- aggregate numerator/denominator before calculating a rate
- zero denominator returns unavailable/null
- missing data remains distinct from actual zero
- display rounding is 2 decimal places for percentages and monetary per-unit metrics
- archived records are excluded from normal analytics
- reporting currency is configured per deployment
- daily Reach/Users may be summed but must not be misrepresented as deduplicated period uniques
- source-reported email opens are accepted as entered
- GLOBAL, CHANNEL, PLATFORM and CAMPAIGN KPI targets are supported
- target specificity precedence is CAMPAIGN > PLATFORM > CHANNEL > GLOBAL
- target period type must match the evaluation period
- KPI status output is neutral: NO_TARGET, NO_DATA, MEETS_TARGET, MISSES_TARGET

Next phase:

**Step 5 — Architecture & Technology Decisions**
