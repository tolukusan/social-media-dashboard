# M09 — Administration Hardening

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Complete archive, audit and correction flows needed for reliable administration.

## Scope

- campaign archive
- performance-record archive
- channel/platform deactivation behaviour
- AuditLog high-value events
- admin correction paths
- historical attribution checks

## Non-Goals

- event sourcing
- general-purpose audit analytics

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

- [ ] normal hard delete is not used
- [ ] archived performance excluded from analytics
- [ ] historical references remain visible
- [ ] approved audit events are recorded
- [ ] Marketing Officer cannot perform Admin-only archive actions

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
