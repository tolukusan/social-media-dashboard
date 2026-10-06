# M07 — Dashboard

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Build the central responsive dashboard using the authoritative analytics API.

## Scope

- current-month default
- KPI cards
- trend chart
- channel performance chart
- campaign comparison view
- performance table
- date/channel/campaign/platform/KPI filters
- loading/error/empty states
- role-appropriate UI

## Non-Goals

- dashboard builder
- custom widget editor
- saved dashboard templates

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

- [ ] dashboard reflects backend analytics
- [ ] filters update results
- [ ] no frontend KPI formula duplication
- [ ] Management can view but not edit data
- [ ] charts are readable and responsive

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
