# Remote continuation review follow-up

Date: 2026-10-07. Execution authorised by the stakeholder's request to proceed with the remote-work review recommendations.

Base: `chatgpt/pdfkit-renderer` at `d76e0a6f31d85bf4fa4d8692a0befe14eec50e96`. Preserve the existing continuation, local environment files, analytical data and import formats. Do not merge or deploy.

## Bounded execution order

1. **F09 verification:** restore the text cursor after chart drawing; keep rows within page margins; represent single-point and unavailable trends; test extracted PDF text, pagination, Unicode, chart presence and post-chart layout. Record PDFKit/font deployment tradeoffs in an ADR. No KPI calculations change.
2. **F01 verification:** use the approved PostgreSQL 18 baseline in CI and retain exact commands/results. Preserve assertions when fixing actual failures.
3. **F10 verification:** exercise the existing write-route matrix through real HTTP, session, Origin and CSRF guards for anonymous, permitted and forbidden callers. Verify denied writes leave domain/audit data unchanged. Reuse existing business-flow tests.
4. **F11 verification:** provide isolated representative data, 25 independently authenticated users, warm-up, a small write workload, and a separate PDF scenario. Record dataset size, duration, local evaluation thresholds, counts and limitations.
5. **F12 verification:** restore into a uniquely named isolated local database; compare domain data and confirm restored API health/authenticated reads. Never restore over or drop development databases.
6. **R05 evidence:** reconcile current ledger/TODO/blockers without rewriting historical evidence; record approval provenance for the previously unresolved own-password and simultaneous missing-data/missing-target decisions. Both existing decisions were explicitly [approved on 2026-10-07](../../governance/completion-decisions-2026-10-07.md); no historical approval is inferred.
7. Run format/lint, typecheck, unit/integration tests, builds, browser journeys, restore and load checks against the final code. Retain CI evidence; prepare a reviewable PR to `main` without merging.

## Dependencies and limits

- Project-local dependency installation, local PostgreSQL 18, Chromium and k6 must be available. Tests use validated isolated databases only.
- PDF parsing is test-only; the production renderer remains PDFKit. Extended glyph support depends on a suitable deployed font.
- Actual SMTP inbox delivery, human usability participation, organisation reporting currency, historical import approval and external deployment remain separate dependencies.
- A green workflow does not replace acceptance criteria or human evidence. Record failed, skipped and unavailable checks honestly.

## Results

Execution is underway. The live remaining-action handoff is in [TODO.md](../../../TODO.md), including focused PDF verification already passed and the relationship to the superseded AI-generated prompt. Detailed final evidence will be appended to `docs/evidence/IMPLEMENTATION_PROGRESS.md` and linked from the completion ledger.
