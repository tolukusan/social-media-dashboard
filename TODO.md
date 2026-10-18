# Implementation work

The completed MVP baseline remains intact. The stakeholder has approved the [connected-account redesign](docs/plans/completion/connected-account-analytics.md): account analytics will be distinct from campaign performance, with the workflow Connect → Sync → Analyse → Report. AAN-01 is complete locally under [ADR-012](docs/decisions/ADR-012-connected-account-analytics.md); the existing [live integration follow-up](docs/plans/completion/live-integrations.md) remains the historical implementation record for Facebook Ads, Instagram Ads, LinkedIn Ads, and Zoho Campaigns. AAN-02 (OAuth and credential lifecycle) is next.

Live activation requires provider access tokens, approved account permissions, compatible reporting-day boundaries, and a real account comparison. OAuth and the named organic/YouTube providers are sequenced in the new plan; API access remains conditional on credentials and provider approval.

Completed work and verification are recorded in the [completion ledger](docs/plans/completion/README.md) and [implementation progress](docs/evidence/IMPLEMENTATION_PROGRESS.md). Optional and conditional release activities are in the [release checklist](docs/guides/release-checklist.md); the historical import-approval question is tracked in [BLOCKERS](BLOCKERS.md).
