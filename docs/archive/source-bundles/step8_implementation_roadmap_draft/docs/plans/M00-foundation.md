# M00 — Repository Foundation

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Create the working pnpm monorepo and baseline developer environment without implementing product features.

## Scope

- pnpm workspace root
- Next.js app under `apps/web`
- NestJS app under `apps/api`
- `packages/shared` placeholder only if genuinely needed
- TypeScript configuration
- lint/format configuration
- environment example
- basic health/startup wiring
- test runner scaffolding
- Playwright scaffolding
- local PostgreSQL development approach
- root scripts for lint, typecheck, test and build

## Non-Goals

- business entities
- authentication
- campaign logic
- analytics
- UI feature work

## Required Process

1. INVESTIGATE current repository state.
2. Compare current state with approved documentation.
3. Produce a bounded implementation plan.
4. Implement only this milestone.
5. Add/update relevant tests.
6. Run required verification.
7. Produce completion report.
8. Submit for review before beginning the next milestone.

## Acceptance Criteria

- [ ] `pnpm install` succeeds
- [ ] web application starts
- [ ] API application starts
- [ ] API health route responds
- [ ] lint passes
- [ ] typecheck passes
- [ ] test command runs
- [ ] build succeeds
- [ ] `.env.example` contains placeholders only

## Verification

At minimum:

```text
lint
typecheck
relevant unit tests
relevant integration tests
build
relevant E2E smoke tests when applicable
```

Do not mark this milestone complete unless the acceptance criteria and relevant verification checks pass.
