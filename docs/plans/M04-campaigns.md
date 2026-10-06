# M04 — Campaign Management

**Status:** Implemented in F04b (2026-10-05)  
**Phase:** Step 8 Implementation Plan

## Objective

Implement multi-channel, multi-platform campaign creation and maintenance.

## Scope

- campaign list/detail/create/update
- CampaignChannel relationships
- CampaignPlatform relationships
- responsible user
- status/budget/date validation
- transactional create/update
- safe handling of historical channel/platform links
- Admin + Marketing Officer write permissions
- Management read-only access

## Non-Goals

- campaign automation
- campaign publishing
- external ad-platform creation

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

- [x] campaign can use multiple channels
- [x] campaign can use multiple platforms
- [x] platform/channel mismatch is rejected
- [x] invalid dates and statuses are rejected
- [x] inactive or missing responsible user is rejected
- [x] Management cannot modify
- [x] historical links with performance data are not physically removed
- [x] completed campaign metadata is editable by Marketing Officers; structural additions require Administrator

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
