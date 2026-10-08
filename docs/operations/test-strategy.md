# Test Strategy

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Test Strategy  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 6

## 1. Goal

Testing must prove that the system satisfies its approved requirements and that calculations, authorization and major workflows remain correct.

The project shall use a test pyramid:

```text
            E2E
         Integration
      Unit / Domain Tests
```

Most calculation and business-rule tests should be fast unit/domain tests.

Critical database and authorization behaviour should be integration-tested.

Critical user journeys should be E2E-tested.

---

# 2. Test Layers

## 2.1 Unit Tests

Use for:

- KPI formulas
- aggregation logic
- target resolution
- target comparison
- percentage-change logic
- date-period helpers
- campaign date rules
- role/permission helpers

## 2.2 Integration Tests

Use a real test PostgreSQL database for:

- Prisma constraints
- campaign creation transaction
- campaign/channel/platform integrity
- daily performance-record uniqueness
- metric applicability
- authentication/session persistence
- RBAC route behaviour
- analytics queries
- archive exclusion
- report data assembly

Do not mock the database for tests whose purpose is database integrity.

## 2.3 End-to-End Tests

Use browser-level tests for critical journeys:

- Administrator login
- create user
- Marketing Officer login
- create campaign
- enter performance data
- view dashboard
- apply filter
- Management login
- confirm read-only UI
- generate PDF report

**Proposed tool:** Playwright.

---

# 3. Frontend Testing

Use component tests selectively for:

- complex form validation
- permission-sensitive rendering
- filter controls
- empty/error/loading states
- chart data transformation if any exists client-side

Do not duplicate backend business-rule tests in frontend tests.

---

# 4. Backend Testing

**Proposed tools:**

- Vitest or Jest for unit/integration tests
- Supertest-style HTTP testing for NestJS endpoints

Final runner should be standardised during repository scaffolding.

Do not maintain two different backend unit-test runners.

---

# 5. Database Test Data

Use deterministic factories/fixtures.

Seed test data should include:

- Administrator
- Marketing Officer
- Management user
- channels
- platforms
- campaigns
- performance records
- raw metric values
- KPI targets

Tests must not depend on production data.

---

# 6. Calculation Golden Cases

Create fixed calculation fixtures with known answers.

Example:

```text
Day 1:
Clicks = 10
Impressions = 100

Day 2:
Clicks = 90
Impressions = 900

Aggregate CTR
= (100 / 1000) × 100
= 10.00%
```

This explicitly protects against incorrect averaging logic.

Other golden cases:

- zero denominator
- missing denominator
- archived record
- channel filter
- platform filter
- campaign filter
- CPC
- email open rate
- website conversion rate
- weighted average SEO position
- target precedence
- partial-period comparison

---

# 7. Authorization Test Matrix

At minimum:

| Action              | Admin | Marketing Officer | Management |
| ------------------- | ----: | ----------------: | ---------: |
| Create User         |  Pass |              Deny |       Deny |
| Create Campaign     |  Pass |              Pass |       Deny |
| Update Campaign     |  Pass |              Pass |       Deny |
| Archive Campaign    |  Pass |              Deny |       Deny |
| Enter Performance   |  Pass |              Pass |       Deny |
| Update Performance  |  Pass |              Pass |       Deny |
| Archive Performance |  Pass |              Deny |       Deny |
| Manage Channel      |  Pass |              Deny |       Deny |
| View Dashboard      |  Pass |              Pass |       Pass |
| Generate Report     |  Pass |              Pass |       Pass |

Tests shall enforce both HTTP status and no unintended data mutation.

---

# 8. Validation Test Cases

Include:

- duplicate email
- invalid campaign date range
- negative budget
- inactive responsible user
- platform/channel mismatch
- no selected platform
- future performance date
- performance date outside campaign range
- duplicate campaignPlatform/date performance record
- negative count
- invalid metric for channel
- derived metric submitted as raw input
- overlapping KPI targets
- invalid KPI scope combination

---

# 9. Reporting Tests

Test:

- correct reporting period
- filter correctness
- KPI values match AnalyticsService
- charts use report data
- generation date present
- Management can generate
- unauthenticated user cannot generate
- PDF response has expected content type
- filenames are sanitised
- temporary files cleaned if applicable

A report must not have its own independent formula implementation.

---

# 10. Performance Testing

The brief requires basic performance testing under normal expected usage.

MVP performance test scope:

- authenticated dashboard read
- filtered analytics read
- campaign list
- performance-record list
- report generation separately

Initial target environment assumptions will be modest because the project is a single-organisation academic system.

Current reproducible profile in `performance/k6-authenticated.js`:

- 10 campaigns, 300 daily records and 600 raw metric values created only in the isolated local test database
- 5-user/5-second warm-up, followed by 25 independently authenticated users for 30 seconds
- dashboard and trends filtered to a fixture campaign, campaign list and performance-record list
- one view per action with 1.5 seconds think time; assumed mix is 40% dashboard and 20% each trends/campaign/performance reads
- 5 Marketing Officers make one permitted raw-metric correction every tenth iteration; the other users are read-only Management
- a separate 2-user/5-second PDF warm-up retaining cold export latency, then a 2-user/15-second measured PDF-export phase
- failed-request rate below 1%
- p95 HTTP request duration below 1 second

The runner `pnpm --filter @smd/api test:load` creates temporary credentials in ignored `performance/runtime/load-credentials.json` and removes them with its fixtures afterward. Cookie sessions persist between each virtual user's iterations. It aborts on failed-request/check thresholds after five seconds; successful checks must exceed 99%. The one-second p95 target applies to measured mixed/PDF phases, not startup warm-up. Summary JSON retains request counts, throughput, median/p95 latency and errors without credentials. These are local evaluation targets, not stakeholder SLAs or claims of production capacity. The assumed view mix/think time is a baseline model, not observed participant behaviour; burst traffic must be reported separately. Run results must be recorded separately from the existence of the script.

---

# 11. Accessibility and Usability Testing

Manual/automated checks should include:

- keyboard navigation
- visible focus
- form labels
- clear validation messages
- reasonable colour contrast
- responsive layouts
- readable chart labels
- table accessibility
- dashboard comprehension by intended user

Usability testing should include realistic tasks from the approved workflows. The prepared participant tasks and evidence fields are in [usability-test-plan.md](../evidence/usability-test-plan.md); real participant results must not be inferred from automated tests.

---

# 12. Release Verification Command Set

Before a milestone/release is considered complete, the implementation agent should run the repository's equivalent of:

```text
format/lint check
typecheck
unit tests
integration tests
build
selected E2E smoke tests
```

Exact commands will be documented after scaffolding.

The agent must report failures rather than claiming success.

---

# 13. Test Evidence

For academic documentation, retain:

- test plan
- test case IDs
- pass/fail results
- screenshots where useful
- calculation examples
- load-test summary
- usability-test notes
- final acceptance summary

---

# 14. Approved Test Tooling Decisions

## TQ-001 — Unit Test Runner

**Decision:** Vitest, unless a concrete NestJS compatibility issue is discovered during scaffolding. One backend unit/integration runner shall be standardised across the repository.

## TQ-002 — E2E Tool

**Decision:** Playwright.

## TQ-003 — Load Tool

**Decision:** k6.

## TQ-004 — Coverage Threshold

**Decision:** Do not optimise for an arbitrary global coverage percentage. Require strong tests around calculations, authorization, validation, integrity constraints and critical user workflows.

---

# 15. Step 6 Test Approval Status

**Approved v1.0.**

The project shall use unit/domain, PostgreSQL-backed integration, browser E2E, validation, usability/accessibility and basic performance testing as specified above.
