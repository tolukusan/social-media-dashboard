# KPI Target Model and Status Rules

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** KPI Target Model and Status Rules  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 4 — KPI & Analytics Semantics

## 1. Purpose

This document narrows the previously deferred KpiTarget model into explicit business rules.

---

# 2. KpiTarget Logical Model

A KPI target requires:

| Field | Meaning |
|---|---|
| id | Unique target identifier |
| kpiDefinitionId | KPI being targeted |
| scopeType | GLOBAL, CHANNEL, PLATFORM or CAMPAIGN |
| channelId | Required only for CHANNEL scope |
| platformId | Required only for PLATFORM scope |
| campaignId | Required only for CAMPAIGN scope |
| periodType | DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY or CAMPAIGN |
| targetValue | Numeric target |
| comparisonRule | HIGHER_IS_BETTER or LOWER_IS_BETTER |
| effectiveFrom | Start of validity |
| effectiveTo | Optional end of validity |
| createdByUserId | Administrator who created target |
| createdAt | Creation timestamp |
| updatedAt | Update timestamp |

---

# 3. Scope Constraints

## GLOBAL

- channelId = null
- platformId = null
- campaignId = null

## CHANNEL

- channelId required
- platformId = null
- campaignId = null

## PLATFORM

- platformId required
- channelId may be derivable from platform and need not be redundantly stored
- campaignId = null

## CAMPAIGN

- campaignId required
- channelId = null
- platformId = null

The implementation must prevent contradictory scope combinations.

---

# 4. Effective-Date Constraints

- effectiveFrom is required
- effectiveTo is optional
- if effectiveTo exists, it must be >= effectiveFrom
- overlapping targets for the same KPI + scope + periodType are not permitted

---

# 5. Period Compatibility

A target applies when the requested evaluation period matches the target's `periodType`.

Examples:

- DAILY target evaluates a day
- MONTHLY target evaluates a calendar month
- QUARTERLY target evaluates a calendar quarter
- YEARLY target evaluates a calendar year
- CAMPAIGN target evaluates campaign-lifetime context

The MVP should not automatically prorate a monthly target into a daily target.

---

# 6. Comparison Rules

## HIGHER_IS_BETTER

Meets target when:

`actual >= target`

Examples:

- Engagement Rate
- CTR
- Conversions

## LOWER_IS_BETTER

Meets target when:

`actual <= target`

Examples:

- Cost per Click

The comparison direction must be configured explicitly with the target or KPI definition.

---

# 7. Status Output

The analytics engine returns one of:

- NO_TARGET
- NO_DATA
- MEETS_TARGET
- MISSES_TARGET

The UI may add contextual explanatory text but shall not introduce unsupported evaluative labels.

---

# 8. Target Precedence

If several applicable target scopes exist:

1. CAMPAIGN
2. PLATFORM
3. CHANNEL
4. GLOBAL

The first matching target at the highest specificity wins.

---

# 9. Administration

Only Administrator may:

- create KPI targets
- update KPI targets
- end-date/deactivate KPI targets

Marketing Officer and Management may view targets.

Hard deletion should not be necessary in ordinary workflow.
