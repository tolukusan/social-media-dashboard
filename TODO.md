# Implementation work

The completed MVP baseline remains intact. The stakeholder approved the [connected-account redesign](docs/plans/completion/connected-account-analytics.md): account analytics are distinct from campaign performance, with the workflow Connect → Sync → Analyse → Report. AAN-01 and the OAuth/provider/dashboard extension are implemented locally using the canonical analytics store described in [ADR-012](docs/decisions/ADR-012-connected-account-analytics.md). Existing campaign integrations and CSV imports remain available.

Remaining acceptance depends on real provider credentials, approved account permissions, supported API versions, and comparison with provider reports. Audit older unmanaged LinkedIn-mapped campaign values before claiming complete retention compliance. Before deploying multiple API instances, add a durable per-account lease to the process-scheduled OAuth refresh loop.

A separate campaign connector OAuth extension for `IntegrationConnection` records is implemented locally. Its mock-flow and isolated migration checks passed. Provider callback registration and live consent remain external; see [ADR-013](docs/decisions/ADR-013-oauth-credential-lifecycle.md) and [OAuth evidence](docs/evidence/oauth-credential-evidence.md).

Completed work and verification are recorded in the [completion ledger](docs/plans/completion/README.md) and [implementation progress](docs/evidence/IMPLEMENTATION_PROGRESS.md). Optional and conditional release activities are in the [release checklist](docs/guides/release-checklist.md); the historical import-approval question is tracked in [BLOCKERS](BLOCKERS.md).

The usability, Archive → Restore → Delete, and Administrator-approved registration/invitation follow-up is implemented on `feat/usability-archive-registration`. See [verification and migration evidence](docs/evidence/usability-archive-registration-verification.md). Review the feature PR before deployment; apply additive migrations through the documented backup/deployment procedure.
