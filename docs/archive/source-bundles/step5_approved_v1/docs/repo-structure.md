# Repository Structure

**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 5

```text
digital-marketing-analytics/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   ├── public/
│   │   └── ...
│   │
│   └── api/
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── roles/
│       │   ├── channels/
│       │   ├── platforms/
│       │   ├── campaigns/
│       │   ├── metrics/
│       │   ├── performance/
│       │   ├── kpi/
│       │   ├── analytics/
│       │   ├── reports/
│       │   ├── health/
│       │   ├── database/
│       │   └── common/
│       ├── prisma/
│       └── ...
│
├── packages/
│   └── shared/
│       └── src/
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
│   ├── tech-stack.md
│   ├── repo-structure.md
│   │
│   ├── decisions/
│   │   ├── ADR-001-modular-monolith.md
│   │   ├── ADR-002-typescript-web-stack.md
│   │   ├── ADR-003-postgresql-prisma.md
│   │   ├── ADR-004-database-sessions.md
│   │   └── ADR-005-rest-api.md
│   │
│   └── plans/
│
└── ...
```

## Rules

- domain features live in feature directories
- do not create generic `utils` dumping grounds
- shared code must have a clear owner/purpose
- database access stays in API/backend
- frontend never imports Prisma
- frontend never bypasses API to query the database
- business formulas live in backend KPI/analytics services
- report generation reuses analytics services
