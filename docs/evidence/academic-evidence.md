# Academic Evidence Checklist

- Requirements and scope: `docs/product/requirements.md`, `docs/product/scope.md`
- Architecture and boundaries: `docs/architecture/architecture.md`, `docs/architecture/tech-stack.md`, `docs/architecture/repo-structure.md`
- Domain model and ERD: `docs/architecture/domain-model.md`, `docs/architecture/erd.md`
- KPI semantics and tests: `docs/analytics/kpi-catalog.md`, `docs/analytics/analytics-rules.md`, `apps/api/src/analytics`
- Authorization/security: `docs/product/permissions-matrix.md`, `docs/operations/security.md`
- Implementation status: `docs/evidence/IMPLEMENTATION_PROGRESS.md`, `../BLOCKERS.md`
- Verification commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Migration and seed evidence: `apps/api/prisma/migrations`, `apps/api/prisma/seed.ts`
- User journey smoke: `e2e/smoke.spec.ts`

External deployment is intentionally excluded from local evidence until an authorized environment is supplied.
