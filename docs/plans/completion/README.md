# Completion and repository organisation handoff

Date: 2026-10-05. Status: local execution authorised 2026-10-05; see the execution ledger for completed tasks.

## Start here

The current [application configuration follow-up](app-configuration.md) implements the stakeholder's 2026-10-08 request for currency in Settings and development recovery delivery in logs; [local verification](../../evidence/app-configuration-verification.md) passed. The completed implementation handoff is now separate from the [optional release checklist](../../guides/release-checklist.md). Earlier ledger entries retain their verification snapshots; this follow-up supersedes their environment-currency and mandatory human/external acceptance limitations. `TODO.md` records implementation work only.

Current execution follows the authorised [remote review follow-up](review-follow-up.md) and the live [remaining-action handoff](../../../TODO.md). PR #2 was separately authorised and merged into `main` at `9e6937b` on 2026-10-08 after final PR-head CI passed. The root environment template was subsequently committed as `b5dc0ac` and pushed to remote `main` with `f3d63ac`. The AI-generated continuation prompt is superseded; do not replay it. [Policy decisions CD-001/CD-002](../../governance/completion-decisions-2026-10-07.md) were explicitly approved on 2026-10-07. Detailed current verification is in [review follow-up evidence](../../evidence/review-follow-up-verification.md).

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

| Task     | Status           | Implementation/evidence reference                                                                                                                                                                                | Verification result                                                                                                  | Remaining blocker                                                             |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Planning | Complete         | These three documents                                                                                                                                                                                            | Historical Markdown checks                                                                                           | —                                                                             |
| R00      | Complete         | [Recovery inventory](reorganisation-inventory.md)                                                                                                                                                                | 119 recovery hashes match; git ignore boundaries verified                                                            | None                                                                          |
| F00      | Complete         | [Acceptance matrix](acceptance-matrix.md)                                                                                                                                                                        | Source/criterion reconciliation; Markdown checks recorded in progress                                                | Import approval provenance unresolved                                         |
| R01      | Complete         | Root/docs README, safe TODO, governance and operating restrictions                                                                                                                                               | Active links and formatting verified                                                                                 | None                                                                          |
| R02      | Complete         | [Inventory](reorganisation-inventory.md), archive index and current document map                                                                                                                                 | 71 intended moves verified; 135 active links resolve                                                                 | Historical snapshot links remain preserved                                    |
| R03      | Implemented      | Imports and other web owners extracted under features with thin routes                                                                                                                                           | Structured-import browser coverage and CI run #37714435674 passed                                                    | None beyond successful verification                                           |
| R04      | Complete         | Web formatting/type discovery, doc checks, ignore rules and E2E origin                                                                                                                                           | Extracted source and maintained docs covered                                                                         | None                                                                          |
| F01      | Complete         | Vitest, isolated PostgreSQL scripts, API/HTTP integration test, three-role Playwright runner                                                                                                                     | lint/typecheck/unit 27/integration 2/E2E 3/build/docs formatting all passed                                          | None                                                                          |
| F02      | Implemented      | Shared query/form/session foundation plus approved Tailwind PostCSS setup                                                                                                                                        | Local checks and PostgreSQL 18 CI run #37714435674 passed                                                            | No package-install blocker remains                                            |
| F03      | Verified locally | User lifecycle, caller-scoped profile and own-password change; approval CD-001 dated 2026-10-07                                                                                                                  | 34 isolated integration tests and PostgreSQL 18 CI run #37714435674 passed                                           | None                                                                          |
| F04a     | Complete         | Administrator channel/platform lifecycle UI and backend validation/association guard                                                                                                                             | API/web typecheck; catalogue unit 3, isolated HTTP/database integration 4, seven-journey E2E and CI passed           | None                                                                          |
| F04b     | Complete         | Campaign editing, search/status filters, transactional association updates, completed-campaign role rule                                                                                                         | API/web typecheck; unit 28/integration 5/E2E 3/build passed                                                          | None                                                                          |
| F05      | Complete         | Dynamic manual raw-metric entry/edit/archive, context/metric validation, search/date filters, provenance                                                                                                         | API/web typecheck; unit 28/integration 6/E2E 3/build passed                                                          | Archived rows reserve campaign-platform/date under existing unique key        |
| F06a     | Complete locally | [Analytics progress](../../evidence/IMPLEMENTATION_PROGRESS.md#completion-execution--f06a-partial): aggregation metadata, raw/derived values, scoped filters/counts, import duplicate aggregation, report parity | API/web typecheck; unit 32/integration 6/API build/web build passed                                                  | Select operational currency in Settings; release configuration                |
| F06b     | Complete         | Calendar comparisons, explicit trend gaps, percentage changes and dimension endpoint; UI charts now implemented                                                                                                  | Historical calculation checks retained; current unit/integration verification passed                                 | Final browser/CI verification recorded in review follow-up evidence           |
| F06c     | Verified locally | Period-aware target evaluation, overlap guard and NO_DATA precedence; approval CD-002 dated 2026-10-07                                                                                                           | Current 42 unit and 34 integration tests; PostgreSQL 18 CI run #37714435674 passed                                   | None                                                                          |
| F07      | Complete locally | Shared filters, backend target/trend data, accessible tables and Recharts trend                                                                                                                                  | Local typecheck/unit/integration/build and current seven-journey E2E passed                                          | Optional human review; prior PR CI passed                                     |
| F08      | Complete locally | Analytics Recharts trend/comparison, target lifecycle and read-only views                                                                                                                                        | Source/build verification and current seven-journey E2E passed                                                       | Optional human review; prior PR CI passed                                     |
| F09      | Complete locally | PDFKit renderer, bounded wrapping/pagination, vector chart/null gaps, Unicode-font support and ADR-008                                                                                                           | 3 rendered-PDF tests and current browser PDF-download assertions passed                                              | Optional human PDF review; automated acceptance passed                        |
| Recovery | Complete locally | [Password recovery handoff](../password-recovery.md): token lifecycle, SMTP adapter, UI, configuration, and strict unsafe-method Origin enforcement                                                              | Integration/browser coverage and PostgreSQL 18 CI run #37714435674 passed                                            | SMTP inbox delivery is a conditional release check; development logs verified |
| F10      | Verified locally | Unsafe Origin/CSRF controls, audit events, cleanup, metadata and real HTTP write/read/logout matrix                                                                                                              | 34 integration tests, 25 new authorization cases, and PostgreSQL 18 CI run #37714435674 passed                       | None                                                                          |
| F11      | Complete locally | Expanded browser journeys and isolated representative mixed-write/separate-PDF load harness                                                                                                                      | Current seven-journey E2E and final 25-VU mixed/separate PDF load phases passed; burst/cold-PDF diagnostics retained | Optional participant testing; prior PR CI passed                              |
| F12      | Complete locally | Current guides/demo/runbook and uniquely isolated PostgreSQL 18 restore verification                                                                                                                             | All 18 restored tables match; health/authentication/campaign/analytics reads, cleanup and CI passed                  | External deployment is a conditional release activity                         |
| R05      | Complete locally | Current review action plan, explicit policy approvals, PDF ADR and current acceptance reconciliation                                                                                                             | `pnpm format:docs`, 223 active relative Markdown links and final local check suite passed                            | Local implementation complete; optional release checks are separate           |

Documentation organisation follow-up (2026-10-06): complete. See the [25-file move record](documentation-reorganisation.md). Active links, moved-document integrity, archive exclusion, and maintained Markdown formatting verified. No product task statuses changed.

Each implementation report must identify behaviour, files changed, tests added/updated, commands/results, migration impact, documentation changes, and remaining risks.

## Copyable execution prompt

Application configuration follow-up (2026-10-08): complete locally. Currency settings, development recovery logs, and the implementation/release documentation split passed lint, typecheck, 48 unit tests, 41 isolated integration tests, build, all seven E2E journeys, and documentation checks. Migration `20261008050000_reporting_settings` was applied to the isolated test database. See [verification evidence](../../evidence/app-configuration-verification.md). No implementation task remains in TODO; optional release work stays in its checklist.

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
