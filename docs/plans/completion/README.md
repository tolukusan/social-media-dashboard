# Completion and repository organisation handoff

Date: 2026-10-05. Status: local execution authorised 2026-10-05; see the execution ledger for completed tasks.

## Start here

The stakeholder requested executable Markdown plans for finishing the application and making the repository easier to maintain. These plans refine the existing M00-M12 milestones; they do not restart the project or replace its approved business rules.

- [Product completion plan](product-completion.md): tasks F00-F12, with dependencies, affected code, acceptance criteria, and tests.
- [Repository reorganisation plan](repository-reorganisation.md): tasks R00-R05, including a safe move map and frontend extraction boundaries.
- [Existing milestone index](../milestone-index.md): original milestone acceptance criteria remain applicable.

## Confirmed stakeholder decision

**The platform is general-purpose digital marketing performance analytics. Educational publishing is not a required product specialisation.**

This decision was explicitly confirmed by the stakeholder on 2026-10-05. Implementing agents must preserve it:

- Use general marketing terminology and examples in the application, demonstration, and current guides.
- Do not introduce books, schools, academic terms, publishers, inventory, or education-specific entities or workflows.
- Do not add industry selection, multi-tenancy, CRM, ecommerce, attribution, or sales-management scope to make the product more general.
- Preserve the original brief and historical approved documents as evidence of project history. Their educational-publishing titles do not override this current product decision.
- Academic submission/test evidence remains a deliverable; general-purpose positioning does not cancel documentation or evaluation.
- R01 will make this decision discoverable from current governance documents without rewriting historical requirements.

Everything else in the existing architecture, permissions, metric semantics, and scope remains authoritative unless a later explicit task changes it.

## Execution authorisation

The request that created these files authorised planning. It did not authorise executing all proposed tasks, deploying, or moving existing files in this turn. A subsequent instruction to execute these plans authorises their bounded local changes; no repeated routine approval is needed between successful tasks. External deployment still requires an explicitly authorised environment.

Existing imports must be preserved. This plan does not infer that their historical scope promotion was approved simply because code exists. F00 checks the available approval trail; an unresolved documentation question must not cause deletion of imports or prevent independent core work.

The stakeholder authorised local execution of this sequence on 2026-10-05. Proposed task descriptions are now the bounded execution plan; external deployment remains outside this authorisation.

## Recommended sequence

1. R00: establish recovery and inventory.
2. F00: establish the actual acceptance baseline and unresolved decisions.
3. R01-R02: clarify documentation authority and organise historical/reference material.
4. R03: extract existing frontend components without behavioural changes.
5. R04: align tooling paths and ignore rules with the new structure.
6. F01: establish reliable verification and safe test data.
7. F02-F05: complete frontend foundations, accounts, catalogues, campaigns, and performance entry.
8. F06a, F06b, F06c: complete analytics contracts, calculations, comparisons, and targets.
9. F07-F09: deliver dashboard, analytics, target administration, and meaningful PDF reports.
10. F10: finish archival/audit and security verification.
11. F11: run complete journeys, accessibility/usability checks, and realistic load tests.
12. F12: finish handover and locally reproducible deployment evidence.
13. R05: final repository/documentation consistency check.

Execute one numbered task or explicitly labelled subtask per bounded change. Do not combine component moves with new business behaviour. Reinspect the actual workspace at the start of each task; paths in these plans describe the planning snapshot or explicitly proposed destinations.

## Working rules for an implementing model

1. Read root `AGENTS.md`, this file, and only the selected task plus its listed references.
2. Inspect existing implementation and tests before editing. Reuse working behaviour rather than rebuilding it.
3. Use the relevant local database, analytics, or security skill when that task changes those areas. Follow applicable installed frontend skills during implementation.
4. State the selected task ID and bounded scope. Implement it, verify it, and update the execution ledger below.
5. Record commands actually run and distinguish passed, failed, skipped, and not run. An endpoint existing or a UI looking plausible is not proof of completion.
6. Update `docs/evidence/IMPLEMENTATION_PROGRESS.md` with evidence, not a blanket completion claim. Map finished work back to M00-M12.
7. Add one concise unresolved blocker to root `BLOCKERS.md` when needed. Continue independent tasks whose prerequisites genuinely exist.
8. Stop the affected task if a formula, permission, data-loss decision, or architectural requirement is undefined. Do not invent a policy to make tests pass.

Never print environment values, passwords, tokens, or connection strings. Do not reset databases, rewrite applied migrations, remove user data, initialise external services, upgrade major framework versions, or alter the engineering playbook.

## Completion record template

Append a short row per executed task; keep detailed results in the progress/evidence documents, not duplicated across plans.

| Task     | Status   | Implementation/evidence reference                                                                                                                                                                                | Verification result                                                                                                            | Remaining blocker                                                                                               |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Planning | Complete | These three documents                                                                                                                                                                                            | Historical Markdown checks                                                                                                     | —                                                                                                               |
| R00      | Complete | [Recovery inventory](reorganisation-inventory.md)                                                                                                                                                                | 119 recovery hashes match; git ignore boundaries verified                                                                      | None                                                                                                            |
| F00      | Complete | [Acceptance matrix](acceptance-matrix.md)                                                                                                                                                                        | Source/criterion reconciliation; Markdown checks recorded in progress                                                          | Import approval provenance unresolved                                                                           |
| R01      | Complete | Root/docs README, safe TODO, governance and operating restrictions                                                                                                                                               | Active links and formatting verified                                                                                           | None                                                                                                            |
| R02      | Complete | [Inventory](reorganisation-inventory.md), archive index and current document map                                                                                                                                 | 71 intended moves verified; 135 active links resolve                                                                           | Historical snapshot links remain preserved                                                                      |
| R03      | Implemented | Imports and other web owners extracted under features with thin routes                                                                                                                                        | Structured-import browser coverage added; current CI verification pending                                                       | None beyond successful verification                                                                              |
| R04      | Complete | Web formatting/type discovery, doc checks, ignore rules and E2E origin                                                                                                                                           | Extracted source and maintained docs covered                                                                                   | None                                                                                                            |
| F01      | Complete | Vitest, isolated PostgreSQL scripts, API/HTTP integration test, three-role Playwright runner                                                                                                                     | lint/typecheck/unit 27/integration 2/E2E 3/build/docs formatting all passed                                                    | None                                                                                                            |
| F02      | Partial  | Shared typed client, query/session/cache foundation, RHF login/campaign/catalogue forms                                                                                                                          | lint/typecheck/unit 27/integration 2/E2E 3/build/docs formatting passed                                                        | Tailwind dependency setup pending; pnpm/corepack currently blocked by NVM4306                                   |
| F03      | Implemented | Admin user lifecycle, caller-scoped profile, and secure own-password change                                                                                                                                    | Current-password/session-revocation integration coverage added; current CI verification pending                                 | None beyond successful verification                                                                              |
| F04a     | Complete | Administrator channel/platform lifecycle UI and backend validation/association guard                                                                                                                             | API/web typecheck; catalogue unit 3 and isolated HTTP/database integration 4 passed                                            | Catalogue lifecycle not covered by browser smoke                                                                |
| F04b     | Complete | Campaign editing, search/status filters, transactional association updates, completed-campaign role rule                                                                                                         | API/web typecheck; unit 28/integration 5/E2E 3/build passed                                                                    | None                                                                                                            |
| F05      | Complete | Dynamic manual raw-metric entry/edit/archive, context/metric validation, search/date filters, provenance                                                                                                         | API/web typecheck; unit 28/integration 6/E2E 3/build passed                                                                    | Archived rows reserve campaign-platform/date under existing unique key                                          |
| F06a     | Partial  | [Analytics progress](../../evidence/IMPLEMENTATION_PROGRESS.md#completion-execution--f06a-partial): aggregation metadata, raw/derived values, scoped filters/counts, import duplicate aggregation, report parity | API/web typecheck; unit 32/integration 6/API build/web build passed                                                            | Deployment `REPORTING_CURRENCY` value is not configured in this workspace                                       |
| F06b     | Complete | [Analytics progress](../../evidence/IMPLEMENTATION_PROGRESS.md#completion-execution--f06b-complete): calendar comparisons, explicit trend gaps, percentage changes, campaign/channel comparison endpoint         | API typecheck/build; unit 35; isolated integration 6 passed                                                                    | F07/F08 still need chart and comparison UI                                                                      |
| F06c     | Implemented | Period-aware target evaluation, precedence/effective dates, concurrent overlap guard, and deterministic missing-data status                                                                                    | Added `NO_DATA` precedence regression; current CI verification pending                                                        | None beyond successful verification                                                                              |
| F07      | Partial  | [Dashboard progress](../../evidence/IMPLEMENTATION_PROGRESS.md#completion-execution--f07-partial): shared filters, channel metadata, target table, real trend table, empty/error states                          | API/web typecheck/build; isolated integration 6; unit 36; Playwright E2E 3 passed                                              | Recharts install unavailable under current local package/network restriction                                    |
| F08      | Partial  | Analytics comparisons, target management, read-only role view, and expanded target/comparison browser coverage                                                                                                   | Target create/edit/end-date, dashboard refresh, and dimension-value Playwright source added; current CI verification pending    | Recharts visualization remains package-gated with F07                                                           |
| F09      | Partial  | Shared report assembly and authenticated preview; labelled KPIs, target status, period comparison, trend values, filters, generation time, and reporting context                                                 | API/web typecheck; Prettier; unit 36; isolated integration 6; production web build; Playwright E2E 3 including download passed | Maintained PDF library install blocked by NVM4306; pagination, embedded chart, and PDF visual inspection remain |
| Recovery | Partial  | [Password recovery handoff](../password-recovery.md): token lifecycle, SMTP adapter, UI, configuration, and strict unsafe-method Origin enforcement                                                               | Integration/browser coverage plus CI verification workflow present; successful run pending                                      | Authorised SMTP inbox delivery remains external                                                                  |

| F10      | Implemented | Unsafe-method Origin enforcement, authorization matrix, required admin audit events, and stale-session cleanup                                                                                                  | Unit/integration coverage added; current CI verification pending                                                                | None beyond successful verification                                                                              |
| F11      | Partial  | Cross-role/core journey plus catalogue/import/accessibility browser coverage and isolated authenticated k6 runner                                                                                                 | CI now includes Playwright and 25-user authenticated load execution; successful run pending                                     | Real participant usability feedback remains external                                                             |
| F12      | Partial  | Current guides, deterministic demo command, deployment runbook, backup/restore procedure, and evidence index                                                                                                      | CI includes isolated backup/restore verification; successful run pending                                                        | External deployment remains M12                                                                                  |
| R05      | Implemented | Current TODO/blockers/progress/evidence/navigation reconciled without rewriting historical baselines                                                                                                            | Documentation formatting/link verification delegated to current CI                                                              | None beyond successful verification                                                                              |

Documentation organisation follow-up (2026-10-06): complete. See the [25-file move record](documentation-reorganisation.md). Active links, moved-document integrity, archive exclusion, and maintained Markdown formatting verified. No product task statuses changed.

Each implementation report must identify behaviour, files changed, tests added/updated, commands/results, migration impact, documentation changes, and remaining risks.

## Copyable execution prompt

```text
Read AGENTS.md and docs/plans/completion/README.md.
Execute the next ready task in the recommended sequence, or the task ID I name.
Follow its acceptance criteria, scope, dependencies, and verification requirements.
Preserve the stakeholder decision that this is a general-purpose marketing platform.
Do not treat historical education-specific wording as a new product requirement.
Reuse working implementation, preserve existing data/imports, and avoid unrelated changes.
Update the execution ledger, IMPLEMENTATION_PROGRESS.md, and unresolved BLOCKERS.md.
Report actual verification results and the next ready task.
```
