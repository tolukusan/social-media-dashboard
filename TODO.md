# Remaining work

Completed implementation is recorded in the [completion ledger](docs/plans/completion/README.md) and [implementation progress](docs/evidence/IMPLEMENTATION_PROGRESS.md). The current authorised action plan is the [remote review follow-up](docs/plans/completion/review-follow-up.md). Remaining work includes acceptance gaps found in that review as well as verification and external evidence.

## Current execution handoff — 2026-10-08

The stakeholder authorised the review recommendations and subsequently requested merging to `main` on 2026-10-08. [PR #2](https://github.com/tolukusan/social-media-dashboard/pull/2) is merged at `9e6937b`; local `main` was updated to match. The root `.env.example` was then explicitly authorised for commit and added locally as `b5dc0ac`; that commit has not been pushed.

**The original AI-generated prompt is superseded by the bounded review follow-up plan. Do not execute it again as a separate task.** Its useful steps—inspect CI, fix genuine failures, reconcile evidence and prepare a PR—are already completed below. Its instruction to continue until CI is green does not override acceptance requirements or repository stop conditions. The merge was separately authorised and completed; external deployment still requires authorisation.

### Already performed in this follow-up

- Reviewed the remote branch, changed implementation, workflow and approved completion criteria; preserved the local untracked root `.env.example`.
- Fetched the continuation and switched to a local `chatgpt/pdfkit-renderer` branch without discarding user files.
- Installed the branch dependencies project-locally; Prisma generation and isolated-test-database preparation passed.
- Fixed PDF chart/text cursor handling and page-width calculation; added single-value/unavailable trend explanations and visible isolated chart points.
- Added development-only PDF.js parsing and three rendered-PDF regression tests. `pnpm --filter @smd/api exec vitest run src/reports/pdf-renderer.test.ts` passed: 3 tests, covering Unicode/values/targets/post-chart bounds, long-report pagination/final content, and zero versus missing trend values.
- Added the PDFKit renderer/font ADR and recorded the stakeholder's explicit approval of both existing own-password and `NO_DATA` precedence decisions. See [approval provenance](docs/governance/completion-decisions-2026-10-07.md).

The verified follow-up changes are merged into `main`. The final PR-head PostgreSQL 18 [CI run #37715030705](https://github.com/tolukusan/social-media-dashboard/actions/runs/37715030705) passed on `73a7aee`; human and external acceptance items remain below.

### Remaining action plan, in execution order

- [x] **F09 — automated PDF acceptance:** three rendered-PDF tests pass, including actual vector paths, Unicode, post-chart text bounds, long-report pagination/final content and zero/missing trends. PDFKit ADR added. Human target-environment visual review remains below.
- [x] **F01 — CI verification:** [run #37714435674](https://github.com/tolukusan/social-media-dashboard/actions/runs/37714435674) passed all workflow steps on commit `495b5ef` in 5m7s, including PostgreSQL 18 setup, lint, typecheck, unit/integration tests, build, all E2E journeys, isolated restore, authenticated load, and documentation formatting. Run #53 remains cancelled historical evidence. GitHub emitted a non-failing Node 20 action deprecation notice while forcing the listed v4 actions onto Node 24.
- [x] **F10 — real HTTP authorization matrix:** 25 new route/read/logout cases pass through session/Origin/CSRF guards, including imports and all existing protected write-role combinations. Domain/recovery/user/audit fingerprints remain unchanged on denied writes. Full isolated integration result: 34 tests passed across 3 files. Metadata coverage is retained.
- [x] **F11 — representative load verification:** the 2026-10-08 run passed authenticated 25-user mixed traffic for 30 seconds (532 requests, p95 396.98 ms, zero failures) and separate PDF warm-up/measured phases (30 measured requests, p95 236.68 ms, zero failures). Temporary fixtures/credentials were removed and the API stopped. The earlier four-phase result and cold-PDF p95 1,065.20 ms/burst p95 6.93 seconds remain diagnostic context; these short local runs do not establish production capacity. See [evidence](docs/evidence/review-follow-up-verification.md).
- [x] **F12 — restore verification:** the local PostgreSQL 18 run passed all-table content fingerprints/counts, restored API health, authentication, campaign and filtered analytics reads. Its unique restore database, backup, API and source fixtures were removed. Non-sensitive runtime results are recorded in the verification evidence.
- [x] **R05 — reconcile documentation:** removed stale package blockers from current status, updated acceptance/progress/ledger/blockers, kept the historical baseline intact, and separated local, CI, human-evidence and deployment status. Linked policy approvals and PDF ADR.
- [x] **Browser regression:** both campaign setups select the seeded `Social Media Marketing` channel and `Facebook` platform. The target edit locator is scoped to the unique campaign so prior isolated-run data cannot match another KPI target. `pnpm --filter @smd/api test:e2e` passed all 7 journeys, including the PDF download. The first rerun exposed an ambiguous import-status locator, which was narrowed to the completion notice; the next rerun exposed a target-row match against persisted fixture data, which was scoped by campaign. See [verification evidence](docs/evidence/review-follow-up-verification.md).
- [x] **Final local checks (2026-10-08):** documentation format and 223 active relative links, lint, typecheck, 42 unit tests, 34 isolated PostgreSQL integration tests, production build, all 7 Playwright journeys, PostgreSQL 18 isolated restore, and authenticated load phases passed. No schema or migration changes. The same checks plus CI artifacts passed on commit `495b5ef` in run #37714435674.
- [x] **Final remote verification and PR:** final PR head `73a7aee` passed [CI run #37715030705](https://github.com/tolukusan/social-media-dashboard/actions/runs/37715030705). Following explicit stakeholder authorisation, PR #2 was marked ready and merged into `main` at `9e6937b` on 2026-10-08. Local `main` was fast-forwarded successfully.
- [x] **Environment template:** committed only the root `.env.example` as `b5dc0ac` on local `main`, following the stakeholder's explicit request. Credential fields use template values; staged whitespace checks passed. This commit is local and has not been pushed or verified by CI.

### Timing and resumption

Continue the numbered work above in this authorised session while capacity is available. CI runs after the relevant changes are committed/pushed; evidence reconciliation and the reviewable PR follow verification. Human/external tasks below wait for their actual prerequisites and are not scheduled or claimed complete.

If session capacity expires, resume from the first unchecked item after inspecting `git status`, this handoff, the follow-up plan and the latest CI run. Preserve all uncommitted work. Do not restart completed work or replay the original prompt. No fixed completion time or automatic continuation after a usage reset is promised.

## Verification and external evidence

- [x] Run the PostgreSQL-backed CI verification successfully: [run #37714435674](https://github.com/tolukusan/social-media-dashboard/actions/runs/37714435674) passed lint, typecheck, unit, integration, build, Playwright, isolated backup/restore, authenticated k6 load, and documentation formatting on commit `495b5ef`.
- [ ] **F09:** perform a human visual review of a deliberately long generated PDF to confirm pagination, wrapping, chart placement, and extended-character rendering in the target environment.
- [ ] **Password recovery:** verify actual inbox delivery with an authorised SMTP provider/sender.
- [ ] **F11:** conduct the prepared usability tasks with real participants and record genuine findings.
- [ ] **F06a:** supply the deploying organisation's approved `REPORTING_CURRENCY`.
- [ ] **F00:** locate or formally resolve the historical import scope-promotion provenance; preserve the existing feature/formats meanwhile.
- [ ] **M12:** deploy only when an external environment is supplied and deployment is explicitly authorised.

## Completed in the current TODO pass

The preceding remote AI pass introduced Tailwind setup, Recharts visualisations with accessible tables and null gaps, PDFKit rendering, strict Origin enforcement, authorization metadata coverage, administration audit events, stale-session cleanup, secure own-password change, deterministic `NO_DATA` precedence, Reports currency formatting, expanded browser coverage, authenticated load tooling, Imports feature extraction, demo data, guides, backup/restore procedure, deployment runbook and usability-test preparation. These are implementation claims; the review follow-up above closes identified acceptance gaps before release completion is claimed.

Never commit credentials or invent external verification evidence.
