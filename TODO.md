# Remaining work

Follow [completion execution order and ledger](docs/plans/completion/README.md), [progress](docs/evidence/IMPLEMENTATION_PROGRESS.md), [acceptance baseline](docs/plans/completion/acceptance-matrix.md) and [blockers](BLOCKERS.md).

Completed work is recorded in the ledger above. This checklist contains only outstanding items.

## Review findings

- [ ] **High priority — F10:** Validate unsafe request Origins against the configured application origin, including login. Verify allowed, disallowed, and missing-Origin behaviour against the approved security rules.
- [ ] **F09:** Fix Reports currency formatting to use the backend-provided reporting currency when configured; retain the unset label only when no currency is configured.
- [ ] **F09:** Replace the single-page PDF renderer with a maintained server-side library. Add wrapping, pagination, non-ASCII font support, and an embedded trend chart; inspect a sample PDF and verify long reports retain all content. Dependency installation is blocked by NVM4306.

## Completion plan

- [ ] **Password recovery:** Implement the [planned email recovery flow](docs/plans/password-recovery.md) when implementation is authorised; configure SMTP for actual email delivery.
- [ ] **F02:** Finish Tailwind setup after the approved project-local dependency installation path is available.
- [ ] **F07/F08:** Add Recharts plots to Overview and Analytics, preserving null gaps and accessible tables. Verify desktop/mobile layout and filter changes.
- [ ] **F08:** Extend browser coverage for target create/edit/end-date and dashboard status refresh, plus campaign/channel comparison values.
- [ ] **F10:** Complete the route/action authorization matrix, required audit events, session cleanup, and security verification.
- [ ] **F11:** Complete the cross-role journey, catalogue lifecycle and import regression coverage, keyboard/accessibility checks, and realistic authenticated load testing.
- [ ] **F11:** Prepare usability tasks and collect actual participant feedback; record participant availability honestly.
- [ ] **R03:** Finish imports UI extraction after meaningful import workflow coverage is in place.
- [ ] **F12:** Finish current user/developer guides, deterministic demo data/script, isolated backup/restore evidence, and the deployment runbook.
- [ ] **R05:** Reconcile active documentation links, acceptance evidence, progress, and the final repository handoff.
- [ ] **M12:** Deploy only after an external environment is available and deployment is explicitly authorised.

## Decisions and dependencies

- [ ] Restore the approved pnpm dependency installation path; Tailwind, Recharts, and the PDF library are currently blocked by NVM4306.
- [ ] **F03:** Resolve current-password verification and session revocation policy for own-password changes, then implement the approved flow.
- [ ] **F06a:** Supply an approved deployment `REPORTING_CURRENCY` value.
- [ ] **F06c:** Resolve status precedence when both actual data and an applicable target are missing, then update evaluation and verification.
- [ ] **F00:** Resolve historical import scope-promotion provenance; preserve existing imports and formats while unresolved.

Local execution is authorised. Follow the task dependencies, verify each coherent change, and continue independent work when a narrow dependency is blocked.

Read [AGENTS.md](AGENTS.md) and the selected task's references before editing. Preserve the general-purpose product decision, existing data and imports. Retain the [local operating restrictions](.ai/LOCAL_OPERATING_RESTRICTIONS.md). Never write credentials here.

## Documentation maintenance

Use the [documentation index](docs/README.md) and [agent guidance index](.ai/README.md) to find current material. Update affected guides with each implementation task; archive superseded documents using the [version archive policy](docs/README.md#keeping-documentation-current). Keep this checklist limited to outstanding work and record completion evidence in the existing ledger.

Keep curated historical documentation under docs/archive rather than accumulating recovery snapshots in the project root.
