# Developer Guide

The repository is a pnpm workspace with a Next.js frontend, NestJS modular-monolith API, shared package, and Prisma/PostgreSQL persistence.

The API owns authentication, authorization, validation, KPI calculations, target resolution, report view models, and audit events. The frontend must consume API results and must not reimplement KPI formulas.

Important module boundaries are `auth`, `users`, `channels`, `campaigns`, `performance`, `analytics`, `targets`, `reports`, and `imports`. Database changes require a Prisma migration and integrity review. Analytics changes require golden, zero/missing-data, filter, aggregation, and target tests. Unsafe HTTP methods are protected by both CSRF validation and exact configured-Origin validation.

Use `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm build` before handoff. `pnpm test` runs unit tests only. The generated Prisma client under `apps/api/src/generated` is build output and should not be edited directly.

## Source and check coverage

Web routes live in `app`, UI owners in `features/components`, and presentation formatting/transport shapes in `lib`. The Imports route is now a thin wrapper over `features/imports` after browser workflow coverage was added. Web lint explicitly includes these owners and TypeScript discovery includes their source paths.

Run `pnpm format:docs` for all maintained root, .ai, and docs documentation, including specifications in topic folders. The command explicitly uses .prettierignore so broad Git ignore rules do not silently skip documentation. Historical source bundles, recovery snapshots, visual reference bundles, and generated outputs remain excluded. Load-test transient output belongs in performance/runtime; curated evidence belongs in docs/evidence.

### Isolated tests

Run `pnpm test:db:prepare` once to create a new uniquely named local PostgreSQL database. It refuses non-loopback hosts and non-default admin databases; it does not reset or clean up databases. The connection string is retained in ignored `apps/api/.test-database`. This local test database persists for reuse.

`pnpm test:unit` runs the API's Vitest unit suite. `pnpm test:integration` deploys existing migrations and seed data only to the verified test database, then runs real PostgreSQL uniqueness and HTTP session-guard checks. The direct integration config also refuses URLs outside the generated `smd_test_<random>` local database name.

`pnpm test:e2e` checks that ports 4201 and 3101 are free, migrates/seeds the isolated database, creates random Argon2id test passwords for Administrator, Marketing Officer and Management, stores credentials in ignored `apps/api/.e2e-credentials`, builds the web app against that test API, starts both local servers, runs Playwright login/read-only smoke, then stops the servers. It fails early if test database setup is missing or either port is occupied. No live Development database is used by this command.

The E2E source covers unauthenticated gating, all three roles, campaign/performance/report flow, KPI-target lifecycle and dashboard refresh, campaign comparison values, catalogue lifecycle, password-reset retry behavior, a structured-import journey, and basic keyboard/mobile checks. Run the suite before claiming those flows pass in a release environment.

For deterministic demonstrations, run `pnpm --filter @smd/api demo:prepare` only against a local/demo database after an active Administrator or Marketing Officer exists. For load testing, run `pnpm --filter @smd/api test:load`: the runner creates isolated fixtures and temporary credentials, then measures warm-up, 25-user mixed reads/corrections, and PDF exports separately. Do not use production credentials. `pnpm --filter @smd/api test:restore` verifies restored data plus authenticated API reads using matching PostgreSQL 18 tools. Both commands clean up their temporary fixtures and retain non-sensitive summaries in ignored `performance/runtime`.

Reports use [PDFKit](../decisions/ADR-008-pdfkit-reports.md) with an operator-configured `REPORT_FONT_PATH` or available DejaVu Sans/Windows Arial. Provision a font covering the deployment's required characters; the default font fallback does not guarantee extended glyph coverage. Rendered-PDF tests use development-only PDF.js and do not replace human visual inspection.
