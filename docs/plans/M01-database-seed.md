# M01 — Database & Seed Foundation

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Implement the approved logical data model in Prisma/PostgreSQL and establish deterministic seed data.

## Scope

- Role, User, MarketingChannel, Platform
- Campaign, CampaignChannel, CampaignPlatform
- MetricDefinition, ChannelMetric
- PerformanceRecord, PerformanceMetricValue
- KpiDefinition, KpiTarget
- Session
- AuditLog if schema-ready
- aggregationStrategy metadata from design amendment v1.1
- initial migration
- seed roles
- seed channels/platforms
- seed metric definitions and channel applicability

## Non-Goals

- full auth behaviour
- frontend screens
- analytics queries
- live integrations/DataSource

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

- [ ] schema represents approved cardinalities
- [ ] migration applies cleanly to empty database
- [ ] seed completes
- [ ] unique constraints exist
- [ ] foreign keys exist
- [ ] platform/channel consistency has an implementation plan
- [ ] derived metrics are not stored as raw PerformanceMetricValue inputs

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
