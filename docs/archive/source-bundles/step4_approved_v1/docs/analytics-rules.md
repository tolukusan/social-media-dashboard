# Analytics and Calculation Rules

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Analytics and Calculation Rules  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 4 — KPI & Analytics Semantics

## 1. Purpose

This document defines how stored daily raw performance values are transformed into dashboard summaries, trends, comparisons and report values.

---

# 2. Calculation Pipeline

The analytics engine shall conceptually follow:

```text
Filter eligible PerformanceRecords
        ↓
Exclude archived records
        ↓
Filter applicable PerformanceMetricValues
        ↓
Aggregate raw metrics
        ↓
Calculate derived metrics
        ↓
Apply KPI target if requested
        ↓
Return summary / comparison / trend output
```

Derived metrics must not be calculated before raw aggregation when the result is intended to represent an aggregate period.

---

# 3. Common Filter Dimensions

All analytical queries should be able to apply relevant combinations of:

- date range
- campaign
- marketing channel
- platform
- metric / KPI

Filters combine using intersection semantics.

Example:

```text
September 2026
AND Campaign = Back to School
AND Channel = Social Media
AND Platform = Instagram
```

Only records satisfying all active filters contribute.

---

# 4. Date Period Definitions

## DAY

One calendar date.

## WEEK

Calendar week. Exact week-start convention will be fixed in implementation configuration/documentation.

**Proposed:** Monday through Sunday.

## MONTH

Calendar month.

## QUARTER

Calendar quarters:

- Q1: January–March
- Q2: April–June
- Q3: July–September
- Q4: October–December

## YEAR

Calendar year.

## CAMPAIGN

Campaign effective period based on startDate/endDate and available records.

---

# 5. Period Comparison Rules

## 5.1 Current Month vs Previous Month

Compare the selected/current calendar month to the immediately preceding calendar month.

## 5.2 Current Quarter vs Previous Quarter

Compare adjacent calendar quarters.

## 5.3 Current Year vs Previous Year

Compare adjacent calendar years.

## 5.4 Partial Current Periods

When the active current period is incomplete, comparison should avoid implying that a full previous period is directly equivalent.

The UI should indicate that the current period is partial.

**Approved MVP behaviour:** for built-in "current vs previous" comparisons, compare the elapsed portion of the current period to the matching elapsed portion of the immediately previous comparable period.

Example: September 1–23 compares to August 1–23.

If an exact matching elapsed period cannot be constructed, the comparison shall remain available only when the UI clearly labels the differing periods.

---

# 6. Difference Calculations

## Absolute Difference

`Difference = Current Value - Previous Value`

## Percentage Change

When Previous Value > 0:

`Percentage Change = ((Current - Previous) / Previous) × 100`

When Previous Value = 0:

- Current = 0 → percentage change = 0%
- Current > 0 → percentage change = null / not mathematically meaningful

Do not display infinity.

When Previous Value is missing:

- percentage change = null

---

# 7. Trend Rules

Trend series shall be built from the selected reporting period and granularity.

Recommended automatic granularity:

| Selected Range | Trend Grain |
|---|---|
| <= 31 days | Daily |
| 32–120 days | Weekly |
| > 120 days | Monthly |

This may be overridden by an explicit user selection if later implemented.

Derived metrics at each trend point must be calculated from that bucket's aggregated raw values.

---

# 8. Channel Comparison Rules

A direct channel comparison is valid only for metrics that are semantically comparable.

Examples of reasonable cross-channel comparisons:

- Impressions
- Clicks
- Conversions
- Spend where both channels support spend

Examples that require care:

- Sessions versus Email Delivered
- Average Search Position versus Reach

The UI should not force unrelated metrics into the same numerical comparison solely because both exist.

---

# 9. Campaign Comparison Rules

Campaign comparisons may use:

- a common selected calendar period
- campaign-lifetime values

When comparing campaign lifetime values, differing campaign durations should be visible to the user.

Do not imply equal exposure time when durations differ.

---

# 10. Dashboard Summary Rules

## Total Campaigns

Count non-archived campaigns matching active filters where campaign filters apply.

## Total Channels

Count active/distinct channels represented in the selected analytical scope.

## Total Reach

Sum applicable raw reach values across eligible records with the uniqueness caveat documented in the KPI catalogue.

## Total Impressions

SUM impressions.

## Total Engagements

SUM engagements.

## Total Clicks

SUM applicable click metrics within the selected channel context.

When multiple channel families are included, the dashboard should avoid merging semantically different click definitions unless the metric is explicitly presented as a broad aggregate click count.

## Engagement Rate

Use:

`Total Engagements / Total Reach × 100`

for applicable Social Media scope.

## Spend

SUM ADS-SPEND.

---

# 11. Cross-Channel Dashboard Behaviour

The dashboard should prefer channel-aware KPI cards.

Example:

If no channel is selected:

- Total Campaigns
- Total Impressions
- Total Clicks
- Total Conversions
- Total Spend

Channel-specific rates should either:

- appear only when applicable, or
- clearly state the contributing channel family.

Do not calculate a single combined CTR by mixing incompatible click/impression definitions from unrelated channel types unless the semantic definition is explicitly approved.

---

# 12. Missing Data Rules

## Missing Record

No PerformanceRecord exists for the expected date/context.

Interpretation:

**Unknown / not entered**, not automatically zero.

## Existing Record with Metric = 0

Interpretation:

The metric was explicitly recorded as zero.

These two states must remain distinguishable.

---

# 13. Null Display Rules

Recommended UI presentation:

- `—` for unavailable/not calculable metric
- `0` for actual zero count
- `0.00%` for a calculated zero percentage with valid denominator
- do not show `NaN`
- do not show `Infinity`

---

# 14. Decimal Precision

## Counts

Display as whole numbers where logically integral.

## Percentages

Display to 2 decimal places.

## Currency

Display to 2 decimal places unless the selected currency convention says otherwise.

## Average Search Position

Display to 2 decimal places.

Calculations should avoid repeated rounding during intermediate steps.

---

# 15. KPI Target Evaluation

Target evaluation requires:

- KPI
- actual calculated value
- selected reporting period
- applicable target scope
- target comparison direction

Process:

```text
Calculate actual value
    ↓
Resolve most specific applicable target
    ↓
If no target → NO_TARGET
    ↓
If no calculable actual → NO_DATA
    ↓
Apply comparison rule
    ↓
MEETS_TARGET or MISSES_TARGET
```

---

# 16. Target Scope Precedence

When several targets are applicable:

```text
Campaign
  > Platform
    > Channel
      > Global
```

Most-specific target wins.

An overlapping target at the same specificity and effective date range is invalid configuration.

---

# 17. Analytics Integrity Tests

At minimum, tests shall verify:

- CTR uses aggregate clicks / aggregate impressions
- Engagement Rate uses aggregate engagements / aggregate reach
- Conversion Rate uses the approved denominator for each channel
- CPC uses total spend / total clicks
- zero denominator returns null
- missing data is not silently treated as zero
- archived records are excluded
- date filters exclude out-of-period records
- campaign filter isolates campaign records
- channel/platform filters isolate relevant records
- weighted SEO position works correctly
- percentage-change zero-baseline behaviour is correct
- KPI target precedence works correctly
- overlapping target validation works correctly
