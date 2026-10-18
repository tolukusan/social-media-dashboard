# Implementation work

The completed MVP baseline remains intact. The stakeholder approved the [connected-account redesign](docs/plans/completion/connected-account-analytics.md): account analytics are distinct from campaign performance, with the workflow Connect → Sync → Analyse → Report. AAN-01 and the OAuth/provider/dashboard extension are implemented locally using the canonical analytics store described in [ADR-012](docs/decisions/ADR-012-connected-account-analytics.md). Existing campaign integrations and CSV imports remain available.

Remaining acceptance depends on real provider credentials, approved account permissions, supported API versions, and comparison with provider reports. Audit older unmanaged LinkedIn-mapped campaign values before claiming complete retention compliance. Before deploying multiple API instances, add a durable per-account lease to the process-scheduled OAuth refresh loop.

Completed work and verification are recorded in the [completion ledger](docs/plans/completion/README.md) and [implementation progress](docs/evidence/IMPLEMENTATION_PROGRESS.md). Optional and conditional release activities are in the [release checklist](docs/guides/release-checklist.md); the historical import-approval question is tracked in [BLOCKERS](BLOCKERS.md).
