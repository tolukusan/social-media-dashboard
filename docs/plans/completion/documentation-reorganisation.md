# Documentation reorganisation - 2026-10-06

Completed by explicit stakeholder request to reorganise docs/. This is a documentation-only follow-up to R02, not a product milestone or a change to business requirements.

## Scope and recovery

Moved 25 root documents into topic folders, retained filenames, updated active Markdown references and agent guidance, and expanded the existing format:docs command to include all maintained documentation. docs/README.md is the navigation entrypoint; the completion handoff remains at its existing path. Archive bundles, visual assets, data, application source, and database migrations are unchanged.

Before moving, active Markdown files were copied to the ignored .reorganisation-backup/docs-2026-10-06/ directory and SHA-256 verified. Those temporary snapshots and one-time helper scripts were removed on 2026-10-06 at the stakeholder's explicit request. The move map below and original R00 inventory remain historical evidence; the old recovery paths are no longer available.

## Move map

| Previous location                 | Current location                            |
| --------------------------------- | ------------------------------------------- |
| `docs/DOCUMENT_MANIFEST.md`       | `docs/governance/DOCUMENT_MANIFEST.md`      |
| `docs/design-amendments-v1.1.md`  | `docs/governance/design-amendments-v1.1.md` |
| `docs/open-questions.md`          | `docs/governance/open-questions.md`         |
| `docs/initial-project-brief.md`   | `docs/product/initial-project-brief.md`     |
| `docs/requirements.md`            | `docs/product/requirements.md`              |
| `docs/scope.md`                   | `docs/product/scope.md`                     |
| `docs/permissions-matrix.md`      | `docs/product/permissions-matrix.md`        |
| `docs/use-cases.md`               | `docs/product/use-cases.md`                 |
| `docs/workflows.md`               | `docs/product/workflows.md`                 |
| `docs/architecture.md`            | `docs/architecture/architecture.md`         |
| `docs/domain-model.md`            | `docs/architecture/domain-model.md`         |
| `docs/erd.md`                     | `docs/architecture/erd.md`                  |
| `docs/tech-stack.md`              | `docs/architecture/tech-stack.md`           |
| `docs/repo-structure.md`          | `docs/architecture/repo-structure.md`       |
| `docs/kpi-catalog.md`             | `docs/analytics/kpi-catalog.md`             |
| `docs/analytics-rules.md`         | `docs/analytics/analytics-rules.md`         |
| `docs/kpi-target-rules.md`        | `docs/analytics/kpi-target-rules.md`        |
| `docs/reporting.md`               | `docs/analytics/reporting.md`               |
| `docs/deployment.md`              | `docs/operations/deployment.md`             |
| `docs/security.md`                | `docs/operations/security.md`               |
| `docs/test-strategy.md`           | `docs/operations/test-strategy.md`          |
| `docs/implementation-roadmap.md`  | `docs/plans/implementation-roadmap.md`      |
| `docs/milestone-index.md`         | `docs/plans/milestone-index.md`             |
| `docs/IMPLEMENTATION_KICKOFF.md`  | `docs/plans/IMPLEMENTATION_KICKOFF.md`      |
| `docs/IMPLEMENTATION_PROGRESS.md` | `docs/evidence/IMPLEMENTATION_PROGRESS.md`  |

## Verification

Results are recorded in the completion ledger and implementation progress. No tests or migrations were added; runtime checks are unnecessary for this documentation-only change. Historical flat-tree diagrams remain labelled as superseded for document placement.
