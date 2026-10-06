# AGENTS.md

## Project

Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies.

This repository implements the approved academic MVP defined in the project documentation.

## Source of Truth

Read project information in this order:

1. Current approved task or milestone plan
2. `design-amendments-v1.1.md`
3. Approved Steps 1–6 documentation in `docs/`
4. Original project brief

A lower-priority source must not silently override a higher-priority source.

## Core Behaviour

Before changing code:

1. identify the requested task
2. read only the documentation relevant to that task
3. inspect the existing implementation
4. compare implementation state with the approved requirement
5. identify dependencies and risks
6. produce or follow a bounded implementation plan

Do not redesign unrelated parts of the application.

## Scope Rules

- Implement only approved MVP functionality unless the task explicitly authorises future scope.
- Do not introduce live marketing API integrations in the MVP.
- Do not introduce AI recommendations, predictive analytics, multi-tenancy, dashboard builders, report builders or user-defined formula builders.
- Do not introduce microservices, Redis, message brokers, GraphQL, Kubernetes or a second analytics database without an approved ADR.
- CSV/spreadsheet import is future scope unless explicitly promoted into a task.

## Architecture Rules

Approved architecture:

- Node.js 24 LTS
- TypeScript
- Next.js + React frontend
- Tailwind CSS
- TanStack Query
- React Hook Form
- Recharts
- NestJS modular-monolith API
- REST JSON API under `/api/v1`
- PostgreSQL 18 baseline
- Prisma ORM 7
- opaque PostgreSQL-backed sessions
- backend RBAC
- backend-owned analytics and report calculations
- pnpm workspace monorepo

Respect module boundaries.

Frontend must not access the database directly.

Frontend must not duplicate authoritative KPI, authorization or business logic.

## Data Rules

- one organisation per deployment
- one User has one Role
- campaigns may use multiple channels
- campaigns may use multiple platforms
- platforms belong to channels
- one active daily PerformanceRecord per CampaignPlatform and recordDate
- raw metric values are the analytical source of truth
- derived KPIs are calculated
- archived records are excluded from normal analytics
- historical references must remain interpretable after deactivation/archive
- normal application workflows do not hard-delete analytical records

## Metric Rules

- do not invent formulas
- use `docs/kpi-catalog.md`
- use `docs/analytics-rules.md`
- use `docs/kpi-target-rules.md`
- aggregate numerator and denominator before calculating a rate
- zero denominator returns unavailable/null
- missing data is not zero
- MetricDefinition aggregation strategy is amended by `design-amendments-v1.1.md`
- future external accounts belong under a future DataSource/IntegrationConnection concept, not directly on Platform

## Authorization Rules

Use `docs/permissions-matrix.md`.

Important boundaries:

- Administrator manages users, channels, platforms, archival actions and KPI targets
- Marketing Officer creates/updates campaigns and performance data
- Management is read-only
- UI visibility is never a substitute for backend authorization

## Security Rules

Use `docs/security.md`.

At minimum:

- Argon2id password hashing
- secure HttpOnly session cookies
- session revocation on logout/deactivation/admin reset
- CORS allowlist
- CSRF protection for unsafe cookie-authenticated requests
- validate all API input
- never log secrets, passwords or raw session tokens
- never expose passwordHash or session-token hashes

## Database Changes

Every schema change requires:

1. domain-model check
2. affected requirement check
3. migration
4. integrity review
5. test update
6. backward/data compatibility review

Use `.ai/skills/database-change/SKILL.md`.

## Analytics Changes

Every KPI/analytics change requires:

1. approved metric semantics
2. golden calculation case
3. zero/missing-data case
4. filter case
5. aggregation case
6. target case where applicable

Use `.ai/skills/analytics-change/SKILL.md`.

## Security-Sensitive Changes

For authentication, authorization, session, password, CSRF, CORS, audit or sensitive-data changes, use `.ai/skills/security-change/SKILL.md`.

## Verification

Before reporting a task complete, run the repository-equivalent checks for:

- format/lint
- typecheck
- relevant unit tests
- relevant integration tests
- build
- relevant E2E smoke test when the task changes a critical user flow

Do not claim a check passed unless it was actually run successfully.

## Stop Conditions

Stop implementation and report the issue instead of improvising when:

- requirements materially contradict each other
- completing the task requires changing an approved architecture decision
- a requested change exceeds the approved milestone
- a schema change risks destructive data loss without an approved migration plan
- a KPI formula or aggregation rule is undefined
- an authorization rule is undefined
- required credentials/external systems are unavailable
- an unrelated failing test indicates a potentially pre-existing regression that cannot be safely resolved within scope
- implementation would require introducing a rejected/out-of-scope technology or product feature

## Change Discipline

Prefer the smallest coherent change that satisfies the approved task.

Do not perform opportunistic rewrites.

Do not rename or reorganise unrelated modules.

Do not upgrade major dependencies unless the task explicitly authorises it.

Document consequential technical decisions in an ADR.

## Completion Report

Every implementation response should include:

- task completed
- files changed
- behaviour implemented
- tests added/updated
- verification commands run and results
- migrations created, if any
- documentation updated, if any
- remaining risks or blockers
