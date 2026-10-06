# SKILL.md — Analytics / KPI Change

## Purpose

Use for any metric, KPI, dashboard calculation, trend, comparison or target change.

## Required Context

- `docs/analytics/kpi-catalog.md`
- `docs/analytics/analytics-rules.md`
- `docs/analytics/kpi-target-rules.md`
- `docs/governance/design-amendments-v1.1.md`

## Procedure

1. Identify affected metric/KPI codes.
2. Confirm RAW vs DERIVED.
3. Confirm aggregation strategy.
4. Confirm numerator/denominator.
5. Confirm zero-denominator behaviour.
6. Confirm missing-data behaviour.
7. Confirm filter dimensions.
8. Confirm archived-record behaviour.
9. Confirm target semantics where applicable.
10. Implement once in backend analytics/KPI services.
11. Add golden calculation tests.
12. Add zero/missing-data tests.
13. Add filter test.
14. Add aggregation test.
15. Add target test when relevant.
16. Verify dashboard/report consumers reuse the same result.

## Non-Negotiable Rules

- do not average percentages unless explicitly defined
- aggregate raw numerator/denominator before calculating rates
- zero denominator returns unavailable/null
- missing data is not zero
- report must not duplicate formula logic
- frontend must not become the authoritative calculator
