# Completion and repository organisation handoff

Date: 2026-10-05. Status: local execution authorised 2026-10-05; see the execution ledger for completed tasks.

## Start here

Implemented follow-up (2026-10-18): [Usability, registration, and administrator archive lifecycle](usability-archive-registration.md) adds archive/restore correctness, confirmed permanent deletion, consolidated navigation/reporting, and Administrator-approved public access/invitations. The seeded Administrator and single-organization model are preserved. See [verification and migration evidence](../../evidence/usability-archive-registration-verification.md). Work is on `feat/usability-archive-registration` for review; no direct merge into main.

Connected-account redesign (2026-10-14, updated 2026-10-18): [AAN-01 and the OAuth/provider/dashboard extension](../../evidence/account-first-analytics-verification.md) use the approved single analytics store. Disconnect retains permitted history; explicit deletion is separate. Existing campaign workflows and CSV imports remain available. [ADR-012](../../decisions/ADR-012-connected-account-analytics.md) records the data boundary and provider retention. Live provider acceptance and the audit of older unmanaged LinkedIn-mapped values remain conditional.

A separate OAuth extension for campaign-level `IntegrationConnection` records is implemented locally. Its mock-flow and isolated migration checks passed; provider callback registration and live consent remain pending. See [ADR-013](../../decisions/ADR-013-oauth-credential-lifecycle.md) and [OAuth evidence](../../evidence/oauth-credential-evidence.md).

Live integrations follow-up (2026-10-08): the stakeholder clarified campaign/advertising/performance scope and explicitly authorised building before keys exist. [The bounded integration plan](live-integrations.md) and [ADR-011](../../decisions/ADR-011-live-integrations.md) describe the implemented Facebook Ads, Instagram Ads, LinkedIn Ads, and Zoho Campaigns adapters, additive migration, campaign mapping, ownership protection, and PostgreSQL scheduling. See [local verification and blockers](../../evidence/live-integrations-verification.md). Existing MVP completion evidence remains historical; live account acceptance is conditional on credentials and compatible source semantics.

Guided UX follow-up (2026-10-08): stakeholder authorised [UX-01?UX-04](simple-ux-proposal.md). The four-step import, automatic suggestions, accepted-scope results/PDF, grouped navigation, date/metric defaults, and mobile fixes are implemented locally. Verification passed: 50 unit tests, 53 integration tests, all 13 browser journeys, typecheck, builds, and changed-code formatting. Full lint remains blocked only by an existing untracked user script; see [execution evidence](../../evidence/simple-ux-verification.md). No migrations or expanded import formats.

Import deletion follow-up (2026-10-08): Administrators can delete uncommitted import staging through a protected, audited endpoint and confirmation dialog. Completed/processing imports and imports referenced by active or archived records remain protected. Verification passed 48 unit tests, 48 integration tests, all nine browser journeys, lint/typecheck, and API/web builds. See [ADR-010](../../decisions/ADR-010-import-deletion.md) and [implementation progress](../../evidence/IMPLEMENTATION_PROGRESS.md).

Dashboard layout follow-up (2026-10-08): fixed page-wide horizontal overflow using constrained flex sizing and grouped, wrapping filter controls. Browser checks passed at 1600, 1024, 768, and 390 pixels, including a long campaign label; the production web build and all nine browser journeys passed. See [implementation progress](../../evidence/IMPLEMENTATION_PROGRESS.md).

Usability follow-up (2026-10-08): tested all four selected data folders in isolation, verified 26 supported imports against source totals, and improved mobile/history navigation, performance pagination, and import guidance/revalidation. Final production build and all nine browser journeys passed. Legacy XLS requires conversion to a supported format. See [selected-folder evidence](../../evidence/selected-folder-verification.md).

Navigation follow-up (2026-10-08): fixed repeated session loading between Imports and the workspace using client navigation and a shared session query. Local verification passed 48 unit tests, 41 integration tests, eight browser journeys, lint/typecheck, and API/Next.js builds; the restarted app passed a live browser navigation check. See [implementation progress](../../evidence/IMPLEMENTATION_PROGRESS.md). No schema or backend authorization change was needed.

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

### Staging consolidation and deployment-preparation follow-up — 2026-10-20

| Task      | Status           | Evidence                                                                                                                                                                                                                        | Verification                                                                                                      | Remaining condition                                                                                      |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| DEPLOY-01 | Prepared locally | [Render setup guide](../../guides/render-deployment.md), [implementation progress](../../evidence/IMPLEMENTATION_PROGRESS.md#staging-consolidation-and-render-deployment-preparation--2026-10-20), same-origin proxy smoke test | Lint, typecheck, 142 unit, 84 integration, API/web builds, docs format, focused proxy E2E, and 25 full E2E passed | User-owned Render setup, deployment, live provider consent, SMTP delivery, and production restore remain |

Each implementation report must identify behaviour, files changed, tests added/updated, commands/results, migration impact, documentation changes, and remaining risks.

### Integration execution addition — 2026-10-08

| Task      | Status                              | Evidence                                                                                                                                                                        | Remaining condition                                                                                      |
| --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| INT-00    | Initial contracts selected          | [ADR-011](../../decisions/ADR-011-live-integrations.md): advertising connectors and cumulative Zoho Campaigns                                                                   | Live account/API approval and any additional provider names                                              |
| INT-01–03 | Implemented locally                 | [Verification inventory](../../evidence/live-integrations-verification.md): additive migration, secure references, four clients, mapping, ingestion, fenced daily scheduler, UI | Tokens, supported versions, matching reporting-day semantics, live acceptance                            |
| INT-04    | Local checks recorded with blockers | [Verification results](../../evidence/live-integrations-verification.md)                                                                                                        | Existing catalogue browser failure and unrelated script formatting prevent a clean full-repository claim |
| AAN-01    | Complete locally                    | [Canonical analytics evidence](../../evidence/account-analytics-verification.md), [ADR-012](../../decisions/ADR-012-connected-account-analytics.md)                             | Audit older unmanaged LinkedIn-mapped values before claiming full retention compliance                   |
| AAN-02    | Implemented locally                 | [Connected-account verification](../../evidence/account-first-analytics-verification.md), [ADR-012](../../decisions/ADR-012-connected-account-analytics.md)                     | Live consent and account access require provider credentials and approval                                |
| AAN-03    | Implemented locally                 | Provider-specific AAN-01 definitions and adapters for Instagram, Facebook, LinkedIn, YouTube, and Zoho                                                                          | Live field/value comparison remains conditional                                                          |
| AAN-04    | Implemented locally                 | Account dashboard, side-by-side comparison, historical reads, and per-account reporting                                                                                         | Live provider acceptance remains conditional                                                             |
| AAN-05    | Preserved                           | Existing CSV import and campaign workflows remain available                                                                                                                     | None                                                                                                     |
| AAN-06    | Implemented locally                 | Daily sync, freshness, PDF reports, metric-level retention, disconnect, and separate deletion                                                                                   | OAuth refresh is process-scheduled, not protected by a durable account lease across API instances        |
| AAN-07    | Local verification passed           | Typecheck, lint, unit and PostgreSQL/HTTP integration suites; populated legacy-migration simulation                                                                             | Real-account validation and older unmanaged LinkedIn audit remain conditional                            |

Supplemental campaign connector OAuth work for `IntegrationConnection` records is implemented locally. The mock-flow and isolated migration checks passed; provider callback registration and live consent remain external. It is separate from the connected-account AAN-02 implementation above; see [ADR-013](../../decisions/ADR-013-oauth-credential-lifecycle.md).

## Copyable execution prompt

Application configuration follow-up (2026-10-08): complete locally. Currency settings, development recovery logs, and the implementation/release documentation split passed lint, typecheck, 48 unit tests, 41 isolated integration tests, build, all seven E2E journeys, and documentation checks. Migration `20261008050000_reporting_settings` was applied to the isolated test database. See [verification evidence](../../evidence/app-configuration-verification.md). No implementation task remains in TODO; optional release work stays in its checklist.

Marketwise control clarity and campaign-data follow-up (2026-10-19): completed locally. See [implementation progress](../../evidence/IMPLEMENTATION_PROGRESS.md#marketwise-control-clarity-and-campaign-data--2026-10-19) and [verification evidence](../../evidence/marketwise-control-clarity-verification.md). Release verification and the provider migration guide are recorded in the evidence, including the default integration timeout and the passing extended-timeout rerun.

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
