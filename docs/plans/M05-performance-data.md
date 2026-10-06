# M05 — Performance Data Entry

**Status:** Implemented in F05 (2026-10-06)  
**Phase:** Step 8 Implementation Plan

## Objective

Implement daily raw metric capture against CampaignPlatform context.

## Scope

- performance record list/create/update
- daily record date
- dynamic raw metrics by channel
- PerformanceMetricValue persistence
- duplicate record prevention
- date-in-campaign validation
- future-date rejection
- raw/derived distinction
- Admin + Marketing Officer entry
- Management read-only

## Non-Goals

- CSV import
- API ingestion
- derived KPI manual entry

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

- [x] one daily PerformanceRecord per CampaignPlatform/date; duplicate and concurrent attempts conflict
- [x] only approved raw metrics can be entered; blanks remain missing and zero is persisted
- [x] invalid metric/channel combinations rejected
- [x] negative values and fractional COUNT values rejected
- [x] future dates rejected
- [x] outside-campaign dates rejected
- [x] derived metrics are not manually persisted
- [x] authorized UI create/edit and Administrator-only archive; normal list excludes archived rows

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
