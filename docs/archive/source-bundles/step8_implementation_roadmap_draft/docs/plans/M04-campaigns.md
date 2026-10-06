# M04 — Campaign Management

**Status:** Proposed  
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

- [ ] campaign can use multiple channels
- [ ] campaign can use multiple platforms
- [ ] platform/channel mismatch is rejected
- [ ] invalid dates are rejected
- [ ] inactive responsible user is rejected
- [ ] Management cannot modify
- [ ] historical links with performance data are not physically removed

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
