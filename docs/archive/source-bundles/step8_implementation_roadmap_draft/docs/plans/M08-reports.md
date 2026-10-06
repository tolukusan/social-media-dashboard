# M08 — Reports & PDF Export

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Generate secure on-demand PDF reports from the same analytics engine used by the dashboard.

## Scope

- report filter form
- report view model
- PDF generation
- KPI summary
- comparisons
- charts where appropriate
- generation date
- safe filename
- authorization

## Non-Goals

- scheduled email reports
- report designer
- persistent report templates
- CSV as mandatory output

## Required Process

1. INVESTIGATE current repository state.
2. Compare current state with approved documentation.
3. Produce a bounded implementation plan.
4. Implement only this milestone.
5. Add/update relevant tests.
6. Run required verification.
7. Produce completion report.
8. Submit for review before beginning the next milestone.

## Acceptance Criteria

- [ ] all roles can generate permitted reports
- [ ] unauthenticated requests denied
- [ ] report values match AnalyticsService
- [ ] PDF content type correct
- [ ] safe filename
- [ ] no duplicate formula implementation

## Verification

At minimum:

```text
lint
typecheck
relevant unit tests
relevant integration tests
build
relevant E2E smoke tests when applicable
```

Do not mark this milestone complete unless the acceptance criteria and relevant verification checks pass.
