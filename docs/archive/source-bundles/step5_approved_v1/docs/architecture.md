# System Architecture

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** System Architecture  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 5 — Architecture & Technology Decisions  
**Depends on:** Steps 1–4 Approved v1.0

## 1. Architecture Goal

The MVP shall use a maintainable three-tier web architecture with clear separation between:

1. presentation
2. application/business logic
3. persistence

The implementation shall remain simple enough for an academic project while preserving clear module boundaries, testability and future extensibility.

---

# 2. Approved Architecture Style

## Modular Monolith

The backend shall be one deployable application organised into domain-focused modules.

It shall **not** be split into microservices for the MVP.

### Reasons

- project scale does not justify distributed services
- one database is sufficient
- simpler local development
- simpler deployment
- easier transactions and data consistency
- easier academic demonstration
- fewer infrastructure dependencies
- domain boundaries can still remain explicit

The modular structure leaves open a future path to extract services only if scale or organisational needs justify it.

---

# 3. High-Level Architecture

```text
┌─────────────────────────────────────────────┐
│               Web Browser                   │
│                                             │
│ Next.js / React UI                          │
│ - dashboard                                 │
│ - forms                                     │
│ - analytics                                 │
│ - reports                                   │
└───────────────────┬─────────────────────────┘
                    │ HTTPS / JSON
                    ▼
┌─────────────────────────────────────────────┐
│                 NestJS API                  │
│                                             │
│ Auth                                        │
│ Users                                       │
│ Channels / Platforms                        │
│ Campaigns                                   │
│ Performance Data                            │
│ Metrics / KPIs                              │
│ Analytics                                   │
│ Reports                                     │
│ Administration                              │
└───────────────────┬─────────────────────────┘
                    │ Prisma ORM
                    ▼
┌─────────────────────────────────────────────┐
│               PostgreSQL                    │
│                                             │
│ relational domain data                      │
│ constraints                                 │
│ sessions                                    │
│ historical records                          │
└─────────────────────────────────────────────┘
```

---

# 4. Presentation Layer

## Technology

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- accessible reusable component primitives
- TanStack Query for API/server state
- React Hook Form for complex data-entry forms
- Zod may be used for client-side form schemas where useful
- Recharts for dashboard and analytics visualisations

## Responsibilities

The frontend is responsible for:

- routing and navigation
- forms and client-side usability validation
- displaying authorization-aware UI
- dashboard presentation
- charts and tables
- loading/error/empty states
- report parameter selection
- calling the API
- responsive/accessibility behaviour

The frontend is **not** the authority for:

- permissions
- KPI formula correctness
- data-integrity enforcement
- authentication validity
- business-rule enforcement

Those rules belong to the backend.

---

# 5. Application / Business Logic Layer

## Technology

- Node.js 24 LTS
- NestJS
- TypeScript

## Style

Feature-oriented modular monolith.

### Proposed modules

```text
AuthModule
UsersModule
RolesModule
ChannelsModule
PlatformsModule
CampaignsModule
MetricsModule
PerformanceModule
KpiModule
AnalyticsModule
ReportsModule
HealthModule
```

An AuditModule may be introduced in Step 6 if audit logging is approved.

## Layering inside a feature

Prefer:

```text
Controller
    ↓
Application/Domain Service
    ↓
Repository / Prisma access
    ↓
Database
```

Controllers should translate HTTP requests/responses and delegate business logic to services.

Business logic must not be duplicated in controllers or frontend components.

---

# 6. Persistence Layer

## Technology

- PostgreSQL 18 baseline
- Prisma ORM 7
- migration-controlled schema changes

## Rationale

The approved domain is strongly relational and requires:

- foreign keys
- unique constraints
- many-to-many relationships
- transactions
- reporting queries
- date filtering
- aggregation
- integrity enforcement

PostgreSQL is a natural fit.

Prisma provides typed application access and migration tooling while retaining PostgreSQL as the source database.

## Version Policy

Do not automatically adopt a new major ORM or database version during implementation.

Any major-version upgrade requires:

- compatibility review
- migration review
- test run
- explicit project decision

---

# 7. API Architecture

## Style

REST over HTTPS using JSON.

## Base Path

```text
/api/v1
```

## Examples

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/users
POST   /api/v1/users

GET    /api/v1/channels
POST   /api/v1/channels

GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id

GET    /api/v1/performance-records
POST   /api/v1/performance-records
PATCH  /api/v1/performance-records/:id

GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/trends
GET    /api/v1/analytics/comparisons

POST   /api/v1/reports/pdf
```

Final routes are implementation details and may be refined without changing approved business semantics.

## API Documentation

The backend should expose OpenAPI/Swagger documentation in development and controlled demonstration environments.

---

# 8. Authentication Architecture

## Model

Use opaque, database-backed application sessions.

### Flow

```text
Login
  ↓
verify email + password
  ↓
create cryptographically random session token
  ↓
store only session token hash in database
  ↓
send raw token in secure HttpOnly cookie
  ↓
subsequent request
  ↓
hash cookie token
  ↓
lookup active unexpired session
  ↓
load active User + Role
  ↓
authorize request
```

## Session Entity

Logical fields:

```text
id
userId
tokenHash
expiresAt
revokedAt
createdAt
lastSeenAt
```

## Cookie

Production cookie should use:

- HttpOnly
- Secure
- SameSite appropriate to deployment topology
- explicit expiry/max-age

## Why Sessions Instead of Client-Stored JWT

For this MVP, database sessions make:

- logout revocation straightforward
- user deactivation straightforward
- active-session control straightforward
- security behaviour easier to demonstrate
- no refresh-token subsystem necessary

No Redis session store is required for the MVP.

---

# 9. Authorization Architecture

Authorization is role-based.

Backend guards/policies must enforce permissions.

Conceptually:

```text
Request
  ↓
Authentication Guard
  ↓
Active User Check
  ↓
Role / Permission Guard
  ↓
Controller
  ↓
Service
```

The permission matrix from Step 3 is the source of truth.

Frontend role checks are only for user experience and must not substitute for backend authorization.

---

# 10. Validation Architecture

Validation occurs at multiple layers.

## Frontend

For usability:

- required fields
- immediate form feedback
- date-format checks
- numeric input hints

## API

Authoritative validation:

- DTO shape
- required fields
- types
- allowed enum values
- format rules

## Service / Domain

Business rules:

- campaign dates
- platform belongs to channel
- performance date falls within campaign dates
- raw metric applicable to selected channel
- duplicate daily performance records
- KPI target scope validity

## Database

Final integrity:

- primary keys
- foreign keys
- unique constraints
- non-null constraints
- supported check constraints where practical

---

# 11. Analytics Architecture

Analytics shall run on the backend.

The frontend shall request already-defined analytical outputs rather than reimplementing formulas.

Example:

```text
GET /analytics/dashboard
    ?from=2026-09-01
    &to=2026-09-23
    &channelId=...
```

Backend pipeline:

```text
validate filters
  ↓
query eligible raw records
  ↓
aggregate raw values
  ↓
calculate derived KPIs
  ↓
resolve target where required
  ↓
return structured result
```

This ensures dashboard, reports and comparisons share one calculation implementation.

---

# 12. Reporting Architecture

Report composition belongs to the backend Reporting module.

The Reporting module shall obtain analytical values from Analytics/KPI services rather than recalculate formulas independently.

Conceptually:

```text
Report request
  ↓
ReportService
  ↓
AnalyticsService / KpiService
  ↓
Report view model
  ↓
PDF renderer
```

The exact PDF rendering library is deferred to Step 6 so deployment constraints can be considered before selecting it.

---

# 13. Repository Architecture

Use one Git repository with a pnpm workspace.

```text
project/
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
│
├── apps/
│   ├── web/
│   │   └── Next.js application
│   │
│   └── api/
│       └── NestJS application
│
├── packages/
│   └── shared/
│       └── framework-neutral shared enums/types where justified
│
├── docs/
│   ├── requirements.md
│   ├── scope.md
│   ├── open-questions.md
│   ├── domain-model.md
│   ├── erd.md
│   ├── permissions-matrix.md
│   ├── workflows.md
│   ├── use-cases.md
│   ├── kpi-catalog.md
│   ├── analytics-rules.md
│   ├── kpi-target-rules.md
│   ├── architecture.md
│   └── decisions/
│
└── ...
```

Do not create a shared package merely to eliminate a few duplicated primitive types.

Shared packages should contain only genuinely cross-application, framework-neutral contracts.

---

# 14. Dependency Boundaries

## Web may depend on

- public API contracts
- frontend libraries
- shared framework-neutral definitions

## Web may not depend on

- Prisma
- backend repositories
- backend database models
- NestJS services

## API may depend on

- Prisma
- PostgreSQL-facing persistence abstractions
- backend infrastructure

## Domain/application services should not depend on

- Next.js
- React
- browser APIs

---

# 15. Configuration

Configuration shall be environment-driven.

Examples:

```text
DATABASE_URL
SESSION_SECRET / session token settings
APP_ORIGIN
API_PORT
REPORTING_CURRENCY
NODE_ENV
```

Secrets shall never be committed to source control.

The final environment-variable list will be documented with deployment instructions.

---

# 16. Time and Date Policy

- Performance `recordDate` is a calendar date, not a timestamp.
- Audit timestamps use UTC in persistence.
- UI may render timestamps in the deployment/user-local timezone.
- Campaign start/end values use calendar dates.
- Analytics calendar boundaries must use one documented reporting timezone per deployment.

The reporting timezone shall be configurable.

---

# 17. Error Architecture

API errors should have a consistent shape.

Example logical structure:

```json
{
  "code": "CAMPAIGN_INVALID_DATE_RANGE",
  "message": "Campaign end date cannot be before start date",
  "details": {}
}
```

Do not expose stack traces or sensitive database errors to end users.

---

# 18. Observability Baseline

The MVP should include:

- structured application logs
- request correlation/request ID where practical
- health endpoint
- startup/configuration failure visibility

Full monitoring infrastructure is deferred to Step 6.

---

# 19. Technology Non-Goals

Do not introduce without a documented need:

- microservices
- message brokers
- Redis
- event sourcing
- CQRS framework
- GraphQL
- Kubernetes
- Elasticsearch
- data warehouse
- separate analytics database
- AI/LLM runtime
- serverless decomposition

---

# 20. Approved Step 5 Decisions

## AQ-001 — Charting Library

**Decision:** Recharts.

Reason: it fits the React frontend and the MVP requires conventional dashboard charts rather than highly specialised visualisation.

## AQ-002 — Styling / Component Layer

**Decision:** Tailwind CSS plus reusable accessible application components.

Avoid a large commercial UI dependency for the MVP.

## AQ-003 — Prisma Major Version

**Decision:** Prisma ORM 7.

The project shall not begin implementation on a release-candidate or newly introduced major ORM line without an explicit migration decision.

## AQ-004 — PostgreSQL Major Version

**Decision:** PostgreSQL 18 baseline.

Do not depend on PostgreSQL-18-only features unless they materially simplify a requirement. Keep SQL reasonably portable across supported PostgreSQL releases.

## AQ-005 — Package Manager

**Decision:** pnpm workspaces.

## AQ-006 — Shared API Contracts

**Decision:** Keep a small `packages/shared` package only for framework-neutral enums/types that are genuinely shared.

Backend validation DTOs remain authoritative.

## AQ-007 — Session Expiry

**Decision:** Deferred to Step 6 security specification.

---

# 21. Step 5 Approval Status

**Step 5 is Approved v1.0.**

Approved architecture:

- TypeScript end-to-end
- Node.js 24 LTS baseline
- Next.js + React frontend
- Tailwind CSS
- TanStack Query
- React Hook Form
- Recharts
- NestJS modular-monolith backend
- REST JSON API under `/api/v1`
- OpenAPI/Swagger in development/demonstration
- PostgreSQL 18 baseline
- Prisma ORM 7
- opaque PostgreSQL-backed sessions in secure HttpOnly cookies
- backend RBAC authorization
- backend-owned KPI/analytics logic
- backend-owned report generation
- pnpm monorepo
- no microservices, Redis, GraphQL, message broker or Kubernetes for MVP

Next phase:

**Step 6 — Security, Testing, Reporting & Deployment**
