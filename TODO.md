# Remaining work

Completed implementation is recorded in the [completion ledger](docs/plans/completion/README.md) and [implementation progress](docs/evidence/IMPLEMENTATION_PROGRESS.md). The remaining items below require verification or external input/evidence rather than additional core feature implementation.

## Verification and external evidence

- [ ] Run the PostgreSQL-backed CI verification successfully: lint, typecheck, unit, integration, build, Playwright, isolated backup/restore, authenticated 25-user k6 baseline, and documentation formatting.
- [ ] **F09:** perform a human visual review of a deliberately long generated PDF to confirm pagination, wrapping, chart placement, and extended-character rendering in the target environment.
- [ ] **Password recovery:** verify actual inbox delivery with an authorised SMTP provider/sender.
- [ ] **F11:** conduct the prepared usability tasks with real participants and record genuine findings.
- [ ] **F06a:** supply the deploying organisation's approved `REPORTING_CURRENCY`.
- [ ] **F00:** locate or formally resolve the historical import scope-promotion provenance; preserve the existing feature/formats meanwhile.
- [ ] **M12:** deploy only when an external environment is supplied and deployment is explicitly authorised.

## Completed in the current TODO pass

Source work now covers Tailwind setup, Recharts visualisations with accessible tables and null gaps, PDFKit report rendering with wrapping/pagination/vector trend chart and Unicode-font support, strict Origin enforcement for all unsafe methods, the authorization matrix, required administration audit events, stale-session cleanup, secure own-password change, deterministic `NO_DATA` target precedence, Reports currency formatting, target lifecycle/dashboard/comparison browser coverage, catalogue/import/keyboard-mobile browser coverage, authenticated load tooling, Imports feature extraction, deterministic demo data, current guides, backup/restore procedure, deployment runbook, and usability-test preparation.

Never commit credentials or invent external verification evidence.
