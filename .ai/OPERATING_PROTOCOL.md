# AI Operating Protocol

**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 7

## 1. Purpose

This protocol controls how an AI coding agent moves from a task request to a verified implementation.

The goal is to prevent one-shot coding, silent requirement invention and uncontrolled refactoring.

---

# 2. Four Working Modes

## MODE A — INVESTIGATE

Use when the task is unclear, risky, cross-cutting or unfamiliar.

Output:

- current implementation state
- relevant requirements
- affected modules/files
- dependencies
- risks
- unresolved contradictions
- recommendation

No production-code changes.

## MODE B — PLAN

Use after investigation or when a task is already well understood.

Output:

- bounded implementation objective
- files/modules expected to change
- ordered implementation steps
- migration impact
- test plan
- acceptance criteria
- explicit non-goals

No production-code changes unless the user/task explicitly authorises implementation in the same instruction.

## MODE C — IMPLEMENT

Use only when:

- the plan is already approved, or
- the task explicitly authorises implementation and enough context exists to form a bounded plan internally

Execution order:

```text
read relevant docs
→ inspect current code
→ implement smallest coherent change
→ add/update tests
→ run verification
→ update docs if behaviour changed
→ report result
```

## MODE D — REVIEW

Use to inspect completed work.

Review against:

- requirements
- design amendments
- architecture
- permissions
- KPI semantics
- security
- test expectations
- milestone acceptance criteria

Review output should separate:

- blocker
- high-priority defect
- medium-priority defect
- low-priority improvement
- verified-correct behaviour

Do not rewrite code during a review-only task unless explicitly asked.

---

# 3. Task Intake

For every task, determine:

```text
What is being changed?
Why is it being changed?
What approved requirement supports it?
Which module owns it?
What must not change?
How will success be verified?
```

If the answers are already available in repo documentation, do not ask the user to repeat them.

---

# 4. Context Loading

Do not read every project file for every task.

Load context progressively.

## Authentication task

Read:

- AGENTS.md
- current milestone/task plan
- design-amendments-v1.1.md if relevant
- docs/product/permissions-matrix.md
- docs/operations/security.md
- docs/architecture/architecture.md
- related source/tests

## Campaign task

Read:

- AGENTS.md
- current plan
- docs/product/requirements.md relevant CAM requirements
- docs/architecture/domain-model.md campaign sections
- docs/product/workflows.md campaign workflows
- docs/product/permissions-matrix.md
- related source/tests

## Performance-data task

Read:

- domain model
- performance workflow
- metric catalogue
- permissions
- related source/tests

## Analytics/KPI task

Read:

- docs/analytics/kpi-catalog.md
- docs/analytics/analytics-rules.md
- docs/analytics/kpi-target-rules.md
- design-amendments-v1.1.md
- related source/tests

## Report task

Read:

- docs/analytics/reporting.md
- analytics/KPI docs
- permissions
- related source/tests

## Database task

Read:

- docs/architecture/domain-model.md
- docs/architecture/erd.md
- design-amendments-v1.1.md
- relevant requirements
- existing schema/migrations/tests

---

# 5. Investigation Checklist

Before proposing implementation:

- inspect current code, do not assume a file exists
- identify current database/schema state
- identify current API route/service state
- identify current frontend state
- identify current tests
- identify current migration history
- compare existing implementation against approved behaviour
- identify whether the task is additive, corrective or destructive

---

# 6. Plan Quality Standard

A plan is good when another engineer could execute it without reinterpreting the requirement.

Bad:

```text
Implement campaign management.
```

Good:

```text
1. Add Campaign, CampaignChannel and CampaignPlatform persistence.
2. Enforce platform/channel consistency in CampaignService.
3. Add transactional create flow.
4. Add POST /api/v1/campaigns.
5. Add RBAC for Admin + Marketing Officer.
6. Add integration tests for valid multi-channel creation and invalid cross-channel platform selection.
7. Add frontend creation form using active channels/platforms.
8. Verify typecheck, integration tests and build.
```

---

# 7. Implementation Rules

- keep code changes within task scope
- use existing patterns when they are correct
- do not preserve a bad pattern merely because it exists
- do not silently change domain semantics
- prefer transactions for multi-record writes
- prefer database constraints where the rule truly belongs in the database
- keep HTTP/controller logic thin
- keep analytics logic centralised
- keep frontend state derived from API responses rather than duplicating server truth

---

# 8. Verification Rules

A task is not done because the code compiles.

Verification must match the risk.

Examples:

## Simple UI copy change

- lint/typecheck
- relevant component test if present

## New API CRUD feature

- unit/integration tests
- authorization case
- validation case
- build

## Schema change

- migration
- migration test or clean test database apply
- integration tests
- build

## Analytics change

- golden calculation case
- zero denominator
- missing-data case
- filter case
- aggregation case
- build

## Security change

- positive authentication/authorization case
- negative case
- session/CSRF/CORS behaviour as applicable
- no sensitive output/logging
- build

---

# 9. Documentation Update Rule

Update documentation only when approved behaviour actually changes.

Do not rewrite source-of-truth documents to match accidental implementation differences.

If code and approved documentation disagree:

- treat documentation as authoritative
- stop if resolving the conflict requires a design change

---

# 10. Completion Standard

An implementation is complete only when:

- acceptance criteria are satisfied
- relevant tests pass
- build/typecheck succeeds
- migration is included where necessary
- no known blocker remains hidden
- implementation summary is accurate
