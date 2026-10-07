# Project documentation

Start with the [completion handoff and ledger](plans/completion/README.md), then read only the documents relevant to the task. [Implementation progress](evidence/IMPLEMENTATION_PROGRESS.md) records verification; the [acceptance matrix](plans/completion/acceptance-matrix.md) records outstanding criteria.

## Document map

| Folder                                              | Contents                                                                                                                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [governance](governance/DOCUMENT_MANIFEST.md)       | Document authority, [approved amendments](governance/design-amendments-v1.1.md), and [open questions](governance/open-questions.md)                                                                       |
| [product](product/requirements.md)                  | [Scope](product/scope.md), [permissions](product/permissions-matrix.md), [use cases](product/use-cases.md), [workflows](product/workflows.md), and the [original brief](product/initial-project-brief.md) |
| [architecture](architecture/architecture.md)        | [Domain model](architecture/domain-model.md), [ERD](architecture/erd.md), [technology stack](architecture/tech-stack.md), and [repository structure](architecture/repo-structure.md)                      |
| [analytics](analytics/kpi-catalog.md)               | KPI catalogue, [calculation rules](analytics/analytics-rules.md), [target rules](analytics/kpi-target-rules.md), and [reporting](analytics/reporting.md)                                                  |
| [operations](operations/deployment.md)              | Deployment, [security](operations/security.md), and [test strategy](operations/test-strategy.md)                                                                                                          |
| [decisions](decisions/ADR-001-modular-monolith.md)  | Architecture decision records                                                                                                                                                                             |
| [plans](plans/milestone-index.md)                   | Original M00-M12 milestones, [roadmap](plans/implementation-roadmap.md), and [current completion plans](plans/completion/README.md)                                                                       |
| [guides](guides/developer-guide.md)                 | Developer, [user](guides/user-guide.md), [local operations](guides/local-operations.md), [deployment](guides/deployment-runbook.md), and [import](guides/imports.md) instructions                                                                     |
| [evidence](evidence/IMPLEMENTATION_PROGRESS.md)     | Implementation results, [academic checklist](evidence/academic-evidence.md), [backup/restore verification](evidence/backup-restore-verification.md), [usability plan](evidence/usability-test-plan.md), and curated load-test results                                                                                                |
| [reference](reference/benchmark/benchmark-audit.md) | Benchmark audit, [traceability](reference/benchmark/benchmark-traceability.md), amendment register, and visual references                                                                                 |
| [archive](archive/README.md)                        | Preserved historical source bundles and provenance                                                                                                                                                        |

## Authority and preservation

Read the current approved task first, then approved design amendments, approved Steps 1-6 specifications and applicable accepted ADRs, and finally the original brief. Folder placement does not change approval or authority; see the document manifest for historical approval notes.

The [current product decision](plans/completion/README.md#confirmed-stakeholder-decision) is general-purpose digital marketing analytics. Historical educational-publishing wording remains project evidence. Archived instructions do not govern current application edits.

Existing imports remain preserved while their original scope-promotion provenance is unresolved; additional formats are not authorised. A checklist is not proof that its deliverables exist.

The 2026-10-06 reorganisation groups specifications by topic. Filenames and business rules remain unchanged. See the [move record](plans/completion/documentation-reorganisation.md) for recovery and verification details.

## Keeping documentation current

Review affected documentation as each new application version is developed. Update documents that still describe the current system. When an approved replacement supersedes a document, move the old document to `docs/archive/versions/<version>/`, preserving its topic structure (for example, `docs/archive/versions/v1/product/requirements.md`). Use the actual superseded release identifier; for unversioned material, use a dated folder such as `docs/archive/versions/2026-10-06/`.

Before archiving, identify the replacement and confirm that no unchanged approved requirements exist only in the old document. Age or incomplete implementation alone does not make an approved requirement obsolete. Archive only superseded material; keep current specifications and guides in their topic folders.

For each archived version, add a README recording the version/date, original locations, reason for archival, and links to current replacements. Preserve historical content and approval evidence, update active links and the document manifest, and check that local links resolve. Keep existing source bundles under `docs/archive/source-bundles/`. Archived versions are historical reference and do not override current approved requirements.
