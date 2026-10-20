# Digital Marketing Performance Dashboard

A general-purpose digital marketing performance analytics MVP for one organisation per deployment. The current product decision is documented in the [completion handoff](docs/plans/completion/README.md). Historical educational-publishing briefs are preserved as project history.

Project specifications and implementation evidence are indexed in [docs](docs/README.md). Track outstanding tasks in [TODO.md](TODO.md) and unresolved dependencies in [BLOCKERS.md](BLOCKERS.md).

For the current handover, start with [Marketwise project documentation](project-documentation/README.md): [setup](project-documentation/SETUP.md), [architecture](project-documentation/ARCHITECTURE.md), [API reference](project-documentation/API.md), [user guide](project-documentation/USER_GUIDE.md), [deployment](project-documentation/DEPLOYMENT.md), and [implementation status/evidence](project-documentation/STATUS.md). It distinguishes current source, historical verification and provider acceptance still needing live checks.

Administrators select the organisation's reporting currency in Settings; monetary values use that saved code without conversion. Development password-recovery links appear in the API terminal when `NODE_ENV=development`. Optional release activities are tracked in the [release checklist](docs/guides/release-checklist.md).

The account-first connected analytics experience is specified in [product design](docs/product/account-first-connected-analytics.md); server-side OAuth setup and owner handoff steps are in the [provider setup guide](docs/integrations/account-provider-setup.md).

## Local setup

Requirements: Node.js 24 LTS, pnpm 11 (packageManager pins 11.8.0), PostgreSQL 18 baseline. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then replace placeholders locally; never commit credentials. SMTP values are required only for real password-recovery email delivery. Follow [local operations](docs/guides/local-operations.md) and [developer guide](docs/guides/developer-guide.md), checking database targets before migrations. Existing development data must be preserved.

```text
pnpm install
pnpm db:generate
pnpm --filter @smd/api exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

The web app runs at `http://localhost:3000`, with the NestJS REST API at `http://localhost:4000/api/v1`. Administrator seed credentials belong only in the local environment. After an active Administrator or Marketing Officer exists, `pnpm --filter @smd/api demo:prepare` creates deterministic local walkthrough data. Do not run demo preparation in production. For the two-service Render deployment and safe database initialization steps, see the [Render deployment guide](docs/guides/render-deployment.md).

```text
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm format:docs
```

Lint checks Prettier formatting. Unit tests use Vitest. Integration and browser tests require the isolated local database prepared with `pnpm test:db:prepare`; the E2E runner prepares its own test users and credentials. Follow the [developer guide](docs/guides/developer-guide.md#isolated-tests) before running database-backed checks. `pnpm test` runs unit tests only. Deployment steps are in the [deployment runbook](docs/guides/deployment-runbook.md).

## Repository map

- `apps/web`: Next.js/React UI; frontend accesses the REST API.
- `apps/api`: NestJS modules, PostgreSQL/Prisma persistence, sessions/RBAC, authoritative analytics and reports.
- `packages/shared`: public transport contracts/constants.
- `e2e`, `performance`: browser and load-test sources.
- [docs](docs/README.md): specifications, plans, guides, reference and evidence.
- [.ai](.ai/README.md): agent guidance, context map, templates, and task-specific skills.

As new versions supersede documents, follow the [documentation archive policy](docs/README.md#keeping-documentation-current). Keep current specifications in topic folders and historical versions under `docs/archive/versions/<version>/`.
