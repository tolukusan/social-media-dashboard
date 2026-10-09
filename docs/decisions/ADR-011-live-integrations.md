# ADR-011: Read-only marketing integrations

Date: 2026-10-08. Status: implemented locally under the stakeholder's explicit instruction to build before API keys are available. Live account verification is pending credentials.

## Decision

Build Facebook Ads and Instagram Ads using Meta advertising insights, LinkedIn Ads using advertising reporting, and Zoho Campaigns using campaign-report snapshots. The stakeholder's clarification selects campaign/advertising/performance ingestion; Zoho Campaigns is the stated implementation assumption. Unnamed providers and organic social-account connectors are not claimed supported.

Keep the NestJS modular monolith and PostgreSQL. `IntegrationConnection` belongs to `Platform`; `IntegrationMapping` identifies one external campaign and one local `CampaignPlatform`; `IntegrationRun` records a bounded sync attempt. A campaign-platform has at most one integration mapping so automatic imports cannot combine overlapping external campaign scopes accidentally. Mappings are retained as provenance. Deactivation/disconnection preserves imported history.

Read-only access tokens are managed by the operator in ignored server environment configuration. Connections store only an allowlisted `INTEGRATION_*_ACCESS_TOKEN` reference, with provider API versions set separately. The UI accepts no token values. This initial implementation does not add browser OAuth redirects or token refresh; the operator obtains and replaces OAuth access tokens through the provider's approved developer setup. Missing credentials block provider calls, not connection setup.

## Data and scheduling

Daily advertising imports map only raw impressions, clicks, and spend. Meta requests separate publisher partitions for Facebook and Instagram. LinkedIn validates campaign account ownership and currency. Provider dates are checked for daily grain and requested range. Missing observations/metrics are unavailable, not zero. Source and deployment reporting timezones must match for daily imports; differing daily boundaries cannot be reconstructed from daily totals. LinkedIn reports use UTC. No existing deployment timezone is changed by this task.

Zoho campaign totals are cumulative snapshots in run history. They are explicitly excluded from daily performance records, dashboards, target calculations, and PDF analytics. A future daily Zoho event adapter requires a separate verified metric/date contract.

Existing records default to unmanaged. Connector-created daily records carry their mapping and a managed flag. Repeating identical values is a no-op; corrections replace only active, managed rows owned by that mapping. Any normal performance edit clears management while preserving the mapping reference, preventing later automatic overwrites. Manual/file records and archived rows become reported conflicts. No analytical record is hard-deleted. Normal updates to owned metric values retain the daily record and source association.

A once-per-minute application timer scans persisted daily schedules. Atomic connection leases fence concurrent workers; expired leases can be reclaimed after crashes. Each normal daily run revisits seven completed source-calendar days for late corrections. Manual ranges are at most 31 completed days. Successful attempts schedule the next daily run; blocked/failed/partial attempts back off for one hour. Settings/mapping changes are locked against running syncs. Disconnect invalidates the lease, preventing further writes. The API process must stay running for schedules to execute.

## Permissions and controls

- All authenticated roles read connection metadata and the last 50 runs.
- Administrators create/configure connections, map campaigns, enable schedules, disconnect, and resume.
- Administrators and Marketing Officers request manual syncs.
- Scheduled work uses the configuring Administrator's attribution and stops importing if that user is deactivated or loses their role. Import transactions recheck active authority, campaign/channel/platform state, and reporting currency.
- Existing session, Origin, and CSRF guards protect endpoints. Fixed provider hosts, bounded response sizes/timeouts/pagination, safe error codes, and explicit response selection prevent arbitrary fetching and secret exposure.

## Migration and recovery

`20261008120000_live_integrations` creates three tables/two enums, adds nullable mapping provenance plus a false-default ownership flag, and adds integrity constraints and indexes. Existing rows retain their data and meaning. Foreign keys restrict deletion of referenced connections/mappings. The migration makes no destructive changes and requires no data backfill.

Operational rollback is to disable the scheduler and disconnect connections while retaining tables and imported records. Do not drop mappings/tables after imports exist or rewrite an applied migration. Operator token revocation is separate from pausing local imports because tokens can be shared by multiple connections.

## Evidence

See the [operator guide](../guides/integrations.md), [implementation plan](../plans/completion/live-integrations.md), and [verification report](../evidence/live-integrations-verification.md). Fixture-based verification does not imply provider approval or live account access.
