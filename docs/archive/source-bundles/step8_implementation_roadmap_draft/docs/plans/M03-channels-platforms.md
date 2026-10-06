# M03 — Channels & Platforms

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Implement Administrator management of channels and platforms with historical-safe deactivation.

## Scope

- channel list/create/update/deactivate
- platform list/create/update/deactivate
- platform belongs to one channel
- seeded defaults visible
- Admin UI
- read-only access for Marketing Officer and Management

## Non-Goals

- DataSource/IntegrationConnection
- API credentials
- automated sync

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

- [ ] Admin can manage channels/platforms
- [ ] non-admin writes are denied
- [ ] platform cannot exist without channel
- [ ] deactivation preserves historical references
- [ ] active filters exclude deactivated choices from new configuration where appropriate

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
