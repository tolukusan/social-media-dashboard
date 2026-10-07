# Remaining work

Completed implementation is recorded in the [completion ledger](docs/plans/completion/README.md) and [implementation progress](docs/evidence/IMPLEMENTATION_PROGRESS.md). This file now contains only work that still needs a package, external value/environment, real participant/provider, or successful verification run.

## Package-gated implementation

- [ ] **F02:** Add the approved Tailwind dependency and finish Tailwind setup when a safe package-install path can update the lockfile.
- [ ] **F07/F08:** Add Recharts plots to Overview and Analytics, preserving null gaps and the accessible tables, after Recharts can be installed normally.
- [ ] **F09:** Replace the handwritten single-page PDF renderer with a maintained server-side PDF library; add wrapping, pagination, non-ASCII font support, an embedded trend chart, and visual long-report verification after the dependency can be installed normally.

## Verification and external evidence

- [ ] Run the new PostgreSQL-backed CI verification successfully: lint, typecheck, unit, integration, build, Playwright, isolated backup/restore, authenticated 25-user k6 baseline, and documentation formatting.
- [ ] **Password recovery:** verify actual inbox delivery with an authorised SMTP provider/sender.
- [ ] **F11:** conduct the prepared usability tasks with real participants and record genuine findings.
- [ ] **F06a:** supply the deploying organisation's approved `REPORTING_CURRENCY`.
- [ ] **F00:** locate or formally resolve the historical import scope-promotion provenance; preserve the existing feature/formats meanwhile.
- [ ] **M12:** deploy only when an external environment is supplied and deployment is explicitly authorised.

## Completed in the current TODO pass

Source work now covers strict Origin enforcement for all unsafe methods, the authorization matrix, required administration audit events, stale-session cleanup, secure own-password change, deterministic `NO_DATA` target precedence, Reports currency formatting, target lifecycle/dashboard/comparison browser coverage, catalogue/import/keyboard-mobile browser coverage, authenticated load tooling, Imports feature extraction, deterministic demo data, current guides, backup/restore procedure, deployment runbook, and usability-test preparation.

Never commit credentials or invent external verification evidence.
