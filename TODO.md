# Remaining work

Completed implementation is recorded in the [completion ledger](docs/plans/completion/README.md) and [implementation progress](docs/evidence/IMPLEMENTATION_PROGRESS.md). The current authorised action plan is the [remote review follow-up](docs/plans/completion/review-follow-up.md). Remaining work includes acceptance gaps found in that review as well as verification and external evidence.

## Current execution handoff — 2026-10-08

The stakeholder first asked for a read-only review of the AI-generated continuation prompt, then authorised proceeding with the review recommendations. Work is now underway locally on `chatgpt/pdfkit-renderer`, based on remote commit `d76e0a6f31d85bf4fa4d8692a0befe14eec50e96`.

**The original AI-generated prompt is superseded by the bounded review follow-up plan. Do not execute it again as a separate task.** Its useful steps—inspect CI, fix genuine failures, reconcile evidence and prepare a PR—are already included below. Its instruction to continue until CI is green does not override acceptance requirements or repository stop conditions. No merge or external deployment is authorised.

### Already performed in this follow-up

- Reviewed the remote branch, changed implementation, workflow and approved completion criteria; preserved the local untracked root `.env.example`.
- Fetched the continuation and switched to a local `chatgpt/pdfkit-renderer` branch without discarding user files.
- Installed the branch dependencies project-locally; Prisma generation and isolated-test-database preparation passed.
- Fixed PDF chart/text cursor handling and page-width calculation; added single-value/unavailable trend explanations and visible isolated chart points.
- Added development-only PDF.js parsing and three rendered-PDF regression tests. `pnpm --filter @smd/api exec vitest run src/reports/pdf-renderer.test.ts` passed: 3 tests, covering Unicode/values/targets/post-chart bounds, long-report pagination/final content, and zero versus missing trend values.
- Added the PDFKit renderer/font ADR and recorded the stakeholder's explicit approval of both existing own-password and `NO_DATA` precedence decisions. See [approval provenance](docs/governance/completion-decisions-2026-10-07.md).

The verified follow-up changes are local and not yet pushed. Passing local checks do not establish final CI, human acceptance, or release completion.

### Remaining action plan, in execution order

- [x] **F09 — automated PDF acceptance:** three rendered-PDF tests pass, including actual vector paths, Unicode, post-chart text bounds, long-report pagination/final content and zero/missing trends. PDFKit ADR added. Human target-environment visual review remains below.
- [ ] **F01 — CI verification:** workflow now uses PostgreSQL 18 and matching backup clients. Run #53 ended cancelled; it is not successful release evidence. Await a new run after the final changes are pushed. The Windows integration runner's `spawn EINVAL` failure was fixed by invoking project tools directly with Node.
- [x] **F10 — real HTTP authorization matrix:** 25 new route/read/logout cases pass through session/Origin/CSRF guards, including imports and all existing protected write-role combinations. Domain/recovery/user/audit fingerprints remain unchanged on denied writes. Full isolated integration result: 34 tests passed across 3 files. Metadata coverage is retained.
- [x] **F11 — representative load verification:** the 2026-10-08 run passed authenticated 25-user mixed traffic for 30 seconds (532 requests, p95 396.98 ms, zero failures) and separate PDF warm-up/measured phases (30 measured requests, p95 236.68 ms, zero failures). Temporary fixtures/credentials were removed and the API stopped. The earlier four-phase result and cold-PDF p95 1,065.20 ms/burst p95 6.93 seconds remain diagnostic context; these short local runs do not establish production capacity. See [evidence](docs/evidence/review-follow-up-verification.md).
- [x] **F12 — restore verification:** the local PostgreSQL 18 run passed all-table content fingerprints/counts, restored API health, authentication, campaign and filtered analytics reads. Its unique restore database, backup, API and source fixtures were removed. Non-sensitive runtime results are recorded in the verification evidence.
- [x] **R05 — reconcile documentation:** removed stale package blockers from current status, updated acceptance/progress/ledger/blockers, kept the historical baseline intact, and separated local, CI, human-evidence and deployment status. Linked policy approvals and PDF ADR.
- [x] **Browser regression:** both campaign setups select the seeded `Social Media Marketing` channel and `Facebook` platform. The target edit locator is scoped to the unique campaign so prior isolated-run data cannot match another KPI target. `pnpm --filter @smd/api test:e2e` passed all 7 journeys, including the PDF download. The first rerun exposed an ambiguous import-status locator, which was narrowed to the completion notice; the next rerun exposed a target-row match against persisted fixture data, which was scoped by campaign. See [verification evidence](docs/evidence/review-follow-up-verification.md).
- [x] **Final local checks (2026-10-08):** documentation format and 223 active relative links, lint, typecheck, 42 unit tests, 34 isolated PostgreSQL integration tests, production build, all 7 Playwright journeys, PostgreSQL 18 isolated restore, and authenticated load phases passed. No schema or migration changes. Full PostgreSQL-backed CI remains pending.
- [ ] **Final remote verification and PR:** after reviewing the local diff and running checks, commit/push bounded changes to the existing continuation branch, verify CI on the exact final code, record the run URL/results, and prepare the PR to `main`. The older draft PR #2 points to `chatgpt/todo-completion`; reconcile it without losing its review history. Do not merge.

### Timing and resumption

Continue the numbered work above in this authorised session while capacity is available. CI runs after the relevant changes are committed/pushed; evidence reconciliation and the reviewable PR follow verification. Human/external tasks below wait for their actual prerequisites and are not scheduled or claimed complete.

If session capacity expires, resume from the first unchecked item after inspecting `git status`, this handoff, the follow-up plan and the latest CI run. Preserve all uncommitted work. Do not restart completed work or replay the original prompt. No fixed completion time or automatic continuation after a usage reset is promised.

## Verification and external evidence

- [ ] Run the PostgreSQL-backed CI verification successfully: lint, typecheck, unit, integration, build, Playwright, isolated backup/restore, authenticated 25-user k6 baseline, and documentation formatting.
- [ ] **F09:** perform a human visual review of a deliberately long generated PDF to confirm pagination, wrapping, chart placement, and extended-character rendering in the target environment.
- [ ] **Password recovery:** verify actual inbox delivery with an authorised SMTP provider/sender.
- [ ] **F11:** conduct the prepared usability tasks with real participants and record genuine findings.
- [ ] **F06a:** supply the deploying organisation's approved `REPORTING_CURRENCY`.
- [ ] **F00:** locate or formally resolve the historical import scope-promotion provenance; preserve the existing feature/formats meanwhile.
- [ ] **M12:** deploy only when an external environment is supplied and deployment is explicitly authorised.

## Completed in the current TODO pass

The preceding remote AI pass introduced Tailwind setup, Recharts visualisations with accessible tables and null gaps, PDFKit rendering, strict Origin enforcement, authorization metadata coverage, administration audit events, stale-session cleanup, secure own-password change, deterministic `NO_DATA` precedence, Reports currency formatting, expanded browser coverage, authenticated load tooling, Imports feature extraction, demo data, guides, backup/restore procedure, deployment runbook and usability-test preparation. These are implementation claims; the review follow-up above closes identified acceptance gaps before release completion is claimed.

Never commit credentials or invent external verification evidence.
