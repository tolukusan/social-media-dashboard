# Academic Evidence Checklist

- Requirements and scope: `docs/product/requirements.md`, `docs/product/scope.md`
- Architecture and boundaries: `docs/architecture/architecture.md`, `docs/architecture/tech-stack.md`, `docs/architecture/repo-structure.md`
- Domain model and ERD: `docs/architecture/domain-model.md`, `docs/architecture/erd.md`
- KPI semantics and tests: `docs/analytics/kpi-catalog.md`, `docs/analytics/analytics-rules.md`, `apps/api/src/analytics`
- Authorization/security: `docs/product/permissions-matrix.md`, `docs/operations/security.md`
- Implementation status: [progress](IMPLEMENTATION_PROGRESS.md), [current blockers](../../BLOCKERS.md), and [review follow-up verification](review-follow-up-verification.md)
- Verification commands: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`, `pnpm format:docs`
- Migration and seed evidence: `apps/api/prisma/migrations`, `apps/api/prisma/seed.ts`
- User journey smoke: `e2e/smoke.spec.ts`
- Authenticated load profile: `performance/k6-authenticated.js`
- Backup/restore procedure and evidence fields: `docs/evidence/backup-restore-verification.md`
- Usability tasks and evidence fields: `docs/evidence/usability-test-plan.md`
- Deterministic demo data: `apps/api/prisma/demo.ts`
- Deployment procedure: `docs/guides/deployment-runbook.md`

External deployment, real SMTP inbox delivery and participant usability results require their actual prerequisites. The isolated PostgreSQL 18 restore has passed locally; current load/browser/CI results and limitations are recorded in the review follow-up evidence. Documentation alone does not establish a successful run or production acceptance.
