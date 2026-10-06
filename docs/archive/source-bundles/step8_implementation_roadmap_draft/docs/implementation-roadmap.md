# Implementation Roadmap

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Implementation Roadmap  
**Version:** 0.1  
**Status:** Draft  
**Phase:** Step 8 — Implementation Roadmap  
**Depends on:** Steps 1–7 Approved, Step 6.5 benchmark amendments

## 1. Purpose

This document defines the order in which the application shall be implemented.

The implementation chat should work milestone-by-milestone.

It must not attempt to build the entire application in one task.

Each milestone has:

- objective
- prerequisites
- scope
- non-goals
- acceptance criteria
- verification requirements

---

# 2. Milestone Sequence

| Milestone | Name | Primary Outcome |
|---|---|---|
| M00 | Repository Foundation | Working monorepo, tooling, environment, CI-ready checks |
| M01 | Database & Seed Foundation | Prisma schema, migrations, core seed data |
| M02 | Authentication & User Management | Login/session/RBAC/user administration |
| M03 | Channels & Platforms | Admin management of marketing channels/platforms |
| M04 | Campaign Management | Multi-channel/multi-platform campaign CRUD |
| M05 | Performance Data Entry | Daily raw performance records and validation |
| M06 | KPI & Analytics Engine | Central calculations, targets, comparisons, trends |
| M07 | Dashboard | Management/operational dashboard with filters |
| M08 | Reports & PDF Export | On-demand filtered PDF reporting |
| M09 | Administration Hardening | Archive flows, audit log, correction controls |
| M10 | Security & Quality Hardening | CSRF/CORS/session/security/accessibility cleanup |
| M11 | Testing & Performance Validation | E2E, usability, validation, basic load tests |
| M12 | Deployment & Academic Deliverables | Production/demo deployment and final documentation |

---

# 3. Milestone Dependency Graph

```text
M00
 ↓
M01
 ↓
M02
 ↓
M03
 ↓
M04
 ↓
M05
 ↓
M06
 ├──→ M07
 └──→ M08
        ↓
M09
 ↓
M10
 ↓
M11
 ↓
M12
```

M07 and M08 both depend on M06.

They may be implemented sequentially, but neither should invent its own analytics logic.

---

# 4. Global Milestone Rules

## RULE-001

A milestone begins only after its prerequisites are complete or explicitly waived.

## RULE-002

Every milestone should have one approved plan under `docs/plans/`.

## RULE-003

The implementation agent must investigate existing state before changing code.

## RULE-004

A milestone is not complete until its acceptance criteria and verification checks pass.

## RULE-005

Do not pull future features into a milestone merely because they are technically convenient.

## RULE-006

If a design contradiction appears, stop and escalate to the architecture/review chat.

## RULE-007

The implementation chat should commit/complete one coherent milestone slice at a time.

---

# 5. Definition of Done

A milestone is done only when:

- approved scope is implemented
- acceptance criteria pass
- relevant tests exist
- lint passes
- typecheck passes
- build passes
- relevant integration tests pass
- relevant E2E smoke tests pass where applicable
- migrations are included where required
- documentation is updated if approved behaviour changed
- completion report is accurate

---

# 6. Recommended Implementation Conversation Pattern

For each milestone:

```text
1. INVESTIGATE
2. PLAN
3. IMPLEMENT
4. VERIFY
5. REVIEW
6. APPROVE
7. MOVE TO NEXT MILESTONE
```

The other ChatGPT conversation should perform 1–4.

This architecture/review conversation should perform 5–6 when needed.

---

# 7. No-Skip Milestones

Do not skip:

- M00
- M01
- M02
- M04
- M05
- M06

These establish the system's technical and analytical foundation.

---

# 8. MVP Completion Point

The MVP is functionally complete after:

```text
M00–M11
```

M12 completes deployment and academic deliverables.

---

# 9. Future Phase After MVP

Not part of the current roadmap:

- CSV/spreadsheet import
- DataSource / IntegrationConnection
- live Meta/Google/Email integrations
- scheduled reports
- dashboard builder
- custom formula builder
- multi-tenancy
- AI recommendations
- predictive analytics
