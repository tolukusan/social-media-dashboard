# DOCUMENT_MANIFEST.md

## Documentation layout update - 2026-10-06

The stakeholder authorised grouping current documents by topic. The [documentation index](../README.md) defines current locations. Earlier flat directory diagrams, original-path inventories, and instructions to keep root specification paths stable describe the previous layout. They are preserved as history and are superseded for document placement only; all substantive requirements and approval statuses remain unchanged.

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Purpose:** Repository document placement, authority, status, and AI context-loading rules  
**Status:** Approved  
**Current Design Baseline:** Steps 1–8 approved, with Step 6.5 benchmark amendments

## 1. Purpose

This file tells Codex or any AI coding agent how to organise and interpret the project documentation.

Do not merge all project documents into one large file.

Do not rename or rewrite approved documents during repository setup unless a later approved task explicitly requires it.

The documentation is intentionally modular so agents can load only the context relevant to the current task.

---

# 2. Repository Placement

Place the downloaded files into the repository using this structure:

```text
project/
├── AGENTS.md
├── .ai/
│   ├── OPERATING_PROTOCOL.md
│   ├── CONTEXT_MAP.md
│   ├── TASK_TEMPLATE.md
│   ├── REVIEW_TEMPLATE.md
│   ├── IMPLEMENTATION_HANDOFF.md
│   │
│   └── skills/
│       ├── implement-feature/
│       │   └── SKILL.md
│       │
│       ├── database-change/
│       │   └── SKILL.md
│       │
│       ├── analytics-change/
│       │   └── SKILL.md
│       │
│       └── security-change/
│           └── SKILL.md
│
└── docs/
    ├── DOCUMENT_MANIFEST.md
    ├── design-amendments-v1.1.md
    ├── IMPLEMENTATION_KICKOFF.md
    ├── IMPLEMENTATION_PROGRESS.md
    ├── requirements.md
    ├── scope.md
    ├── open-questions.md
    ├── domain-model.md
    ├── erd.md
    ├── permissions-matrix.md
    ├── workflows.md
    ├── use-cases.md
    ├── kpi-catalog.md
    ├── analytics-rules.md
    ├── kpi-target-rules.md
    ├── architecture.md
    ├── tech-stack.md
    ├── repo-structure.md
    ├── security.md
    ├── test-strategy.md
    ├── reporting.md
    ├── deployment.md
    ├── benchmark-audit.md
    ├── amendment-register.md
    ├── benchmark-traceability.md
    ├── implementation-roadmap.md
    ├── milestone-index.md
    │
    ├── decisions/
    │   ├── ADR-001-modular-monolith.md
    │   ├── ADR-002-typescript-web-stack.md
    │   ├── ADR-003-postgresql-prisma.md
    │   ├── ADR-004-database-sessions.md
    │   └── ADR-005-rest-api.md
    │
    └── plans/
        ├── M00-foundation.md
        ├── M01-database-seed.md
        ├── M02-auth-users.md
        ├── M03-channels-platforms.md
        ├── M04-campaigns.md
        ├── M05-performance-data.md
        ├── M06-kpi-analytics.md
        ├── M07-dashboard.md
        ├── M08-reports.md
        ├── M09-admin-hardening.md
        ├── M10-security-quality.md
        ├── M11-testing-performance.md
        └── M12-deployment-academic.md
```

---

# 3. Document Authority Order

When documents overlap, interpret them in this order:

```text
1. Current approved milestone/task plan
2. docs/governance/design-amendments-v1.1.md
3. Approved project documents in docs/
4. Accepted ADRs in docs/decisions/
5. Original project brief
6. Existing implementation
```

Important:

The implementation does not override approved documentation merely because code already exists.

If existing code conflicts with approved documentation, treat the documentation as authoritative unless the current task explicitly changes the design.

---

# 4. Operational Instruction Files

## AGENTS.md

Primary repo-wide instructions for AI coding agents.

Read before implementation work.

It defines:

- project scope
- architecture rules
- data rules
- KPI rules
- authorization rules
- security rules
- verification expectations
- stop conditions
- completion reporting

## .ai/OPERATING_PROTOCOL.md

Defines the four working modes:

```text
INVESTIGATE
PLAN
IMPLEMENT
REVIEW
```

Use it to control how work moves from understanding to implementation.

## .ai/CONTEXT_MAP.md

Defines which project documents should be loaded for each type of task.

Use it to avoid loading every project file into context.

## .ai/TASK_TEMPLATE.md

Use when creating a new milestone task or implementation task.

## .ai/REVIEW_TEMPLATE.md

Use when reviewing completed implementation work.

## .ai/IMPLEMENTATION_HANDOFF.md

Use when starting or resetting the separate implementation conversation.

---

# 5. Skills

Use a skill only when the task matches it.

## implement-feature/SKILL.md

For normal bounded application features.

## database-change/SKILL.md

For:

- Prisma schema changes
- migrations
- database constraints
- persistence-model changes

## analytics-change/SKILL.md

For:

- metrics
- KPIs
- dashboard calculations
- comparisons
- trends
- KPI targets

## security-change/SKILL.md

For:

- authentication
- authorization
- passwords
- sessions
- CSRF
- CORS
- audit logging
- sensitive data

Do not create unnecessary additional skills until repeated implementation work demonstrates a clear need.

---

# 6. Documentation Status

The following project phases are approved:

| Phase                                              | Status   |
| -------------------------------------------------- | -------- |
| Step 1 — Requirements Decomposition                | Approved |
| Step 2 — Domain & Data Model                       | Approved |
| Step 3 — Roles, Permissions & Workflows            | Approved |
| Step 4 — KPI & Analytics Semantics                 | Approved |
| Step 5 — Architecture & Technology Decisions       | Approved |
| Step 6 — Security, Testing, Reporting & Deployment | Approved |
| Step 6.5 — Benchmark Review                        | Approved |
| Step 7 — AI Development Operating System           | Approved |
| Step 8 — Implementation Roadmap                    | Approved |

## Step 8 Status Note

Some downloaded Step 8 files may still internally display:

```text
Version: 0.1
Status: Draft
```

because approval occurred after generation.

For project governance purposes, Step 8 is approved.

Treat the following Step 8 files as approved:

```text
docs/plans/implementation-roadmap.md
docs/plans/milestone-index.md
docs/plans/M00-foundation.md
docs/plans/M01-database-seed.md
docs/plans/M02-auth-users.md
docs/plans/M03-channels-platforms.md
docs/plans/M04-campaigns.md
docs/plans/M05-performance-data.md
docs/plans/M06-kpi-analytics.md
docs/plans/M07-dashboard.md
docs/plans/M08-reports.md
docs/plans/M09-admin-hardening.md
docs/plans/M10-security-quality.md
docs/plans/M11-testing-performance.md
docs/plans/M12-deployment-academic.md
docs/plans/IMPLEMENTATION_KICKOFF.md
```

Do not rewrite those files merely to change the status label.

---

# 7. Step 6.5 Amendment Rule

The following baseline applies:

```text
Steps 1–6 approved v1.0
+
Step 6.5 benchmark review
+
docs/governance/design-amendments-v1.1.md
```

`docs/governance/design-amendments-v1.1.md` overrides only the points it explicitly addresses.

It adds:

1. MetricDefinition aggregation metadata
2. future DataSource / IntegrationConnection boundary
3. future CSV/spreadsheet import
4. future source timezone metadata

It does not authorise those future features for MVP implementation unless the current task explicitly promotes them.

---

# 8. Context Loading Rule

Do not read every document for every task.

Use `.ai/CONTEXT_MAP.md`.

Examples:

## Authentication work

Load:

```text
AGENTS.md
current task plan
docs/operations/security.md
docs/product/permissions-matrix.md
docs/architecture/architecture.md
```

## Campaign work

Load:

```text
AGENTS.md
current task plan
docs/architecture/domain-model.md
docs/product/workflows.md
docs/product/permissions-matrix.md
```

## Analytics work

Load:

```text
AGENTS.md
current task plan
docs/governance/design-amendments-v1.1.md
docs/analytics/kpi-catalog.md
docs/analytics/analytics-rules.md
docs/analytics/kpi-target-rules.md
```

## Database work

Load:

```text
AGENTS.md
current task plan
docs/governance/design-amendments-v1.1.md
docs/architecture/domain-model.md
docs/architecture/erd.md
```

---

# 9. Milestone Execution Rule

Implementation must proceed in this order:

```text
M00 Repository Foundation
M01 Database & Seed Foundation
M02 Authentication & User Management
M03 Channels & Platforms
M04 Campaign Management
M05 Performance Data Entry
M06 KPI & Analytics Engine
M07 Dashboard
M08 Reports & PDF Export
M09 Administration Hardening
M10 Security & Quality Hardening
M11 Testing & Performance Validation
M12 Deployment & Academic Deliverables
```

Do not implement later milestone scope early unless an earlier milestone genuinely requires a small dependency.

Such dependencies must remain minimal and must not become premature feature implementation.

---

# 10. Per-Milestone Workflow

For every milestone:

```text
INVESTIGATE
    ↓
PLAN
    ↓
IMPLEMENT
    ↓
VERIFY
    ↓
REVIEW
    ↓
APPROVE
    ↓
NEXT MILESTONE
```

Do not one-shot multiple milestones.

---

# 11. First Implementation Action

The first implementation task is:

```text
M00 — Repository Foundation
```

The implementation agent should:

1. read `AGENTS.md`
2. read `.ai/OPERATING_PROTOCOL.md`
3. read `docs/plans/M00-foundation.md`
4. read `docs/architecture/architecture.md`
5. read `docs/architecture/tech-stack.md`
6. read `docs/architecture/repo-structure.md`
7. inspect the existing repository
8. report the current state
9. produce a bounded M00 plan
10. implement only M00 after the plan is approved or explicitly authorised

Use `docs/plans/IMPLEMENTATION_KICKOFF.md` as the initial handoff instruction.

---

# 12. Document Mutation Rule

During normal implementation:

Do not casually edit:

```text
requirements.md
scope.md
domain-model.md
permissions-matrix.md
kpi-catalog.md
architecture.md
security.md
```

These are design/source-of-truth documents.

If implementation reveals a genuine design issue:

1. stop
2. describe the conflict
3. return the issue to the architecture/review conversation
4. approve a design amendment first
5. then update implementation

Implementation must follow approved design, not silently rewrite it.

---

# 13. Historical Files and Duplicates

If multiple downloaded versions of the same document exist:

Prefer:

```text
approved v1.0
```

over:

```text
draft v0.1
```

Exception:

Step 8 draft-labelled files are approved according to this manifest.

Do not keep multiple copies of the same logical document inside the repository unless they are intentionally archived outside the working documentation tree.

---

# 14. Final Rule

The repository documentation exists to reduce AI improvisation.

The AI agent should not attempt to memorise the entire project.

Instead:

```text
read the current task
→ load relevant approved context
→ inspect current code
→ implement bounded scope
→ verify
→ report
```

That is the required development workflow.

## Current completion execution

Local completion-plan execution was authorised on 2026-10-05. Read the [current handoff and ledger](../plans/completion/README.md) before selecting the next task; do not restart M00 from historical instructions. The product is general-purpose digital marketing analytics. Preserve historical requirements and all unchanged architecture, metric and permission rules. Original import approval provenance remains unresolved; preserve existing imports without expanding formats. External deployment needs an authorised environment.

## Current organisation — R02

Canonical approved root specifications and original milestone plans retain stable paths. Operational guides are in docs/guides; benchmark and Stitch materials in docs/reference; curated academic/load evidence in docs/evidence; preserved source bundles in docs/archive/source-bundles. See [navigation](../README.md), [archive provenance](../archive/README.md) and [original move inventory](../plans/completion/reorganisation-inventory.md). Archived instructions are historical artifacts. Authority ordering and Step 8 approval remain unchanged.
