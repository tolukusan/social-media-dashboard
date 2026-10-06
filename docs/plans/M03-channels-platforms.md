# M03 — Channels & Platforms

**Status:** Implemented in F04a (2026-10-05)  
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

- [x] Admin can create, edit, activate, and deactivate channels/platforms
- [x] non-admin writes are denied by backend role guards
- [x] platform cannot exist without an active channel
- [x] deactivation preserves rows and archived references
- [x] active filters exclude deactivated choices from campaign and import configuration

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
