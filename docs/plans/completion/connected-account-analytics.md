# Connected-account analytics implementation plan

Date: 2026-10-14. Status: stakeholder-approved direction; implementation is proceeding locally in bounded steps.

## Approved product direction

The dashboard's primary journey is **Connect account → Automatic sync → Analytics → PDF report**. The main analytics view will be organised around connected accounts while campaigns remain available for campaign planning and campaign-attributed performance.

The stakeholder selected:

- Facebook: paid advertising and organic Page analytics.
- Instagram: paid advertising and organic account analytics.
- LinkedIn: advertising and organic Page analytics.
- Zoho Campaigns: email marketing analytics.
- YouTube: channel and video analytics.

Preserve the existing CSV imports as a secondary manual-ingestion option. API credentials and live-account authorization will be supplied by the stakeholder when the integrations are ready for live testing. Use fixtures/mock credentials until then. Do not deploy externally, register developer applications, or purchase services without separate authorization.

This plan authorizes scope beyond the completed academic MVP. It preserves the approved single-organisation deployment, modular-monolith/PostgreSQL architecture, RBAC, raw-metric calculation rules, and campaign history. Provider-specific data meanings and retention rules must be explicit; provider rates must not be silently treated as the application's derived KPIs.

## Ordered implementation tasks

### AAN-01 — Account analytics separate from campaigns

Create a provider-scoped daily observation store linked to `IntegrationConnection`, not `CampaignPlatform`. Preserve provider metric identity, meaning, units, aggregation strategy, source API version, account/content scope, and value-level retention metadata. Expose authenticated read and ingestion paths without changing campaign dashboard totals.

Acceptance: additive migration; isolated database tests for uniqueness, foreign keys, source/value validation, idempotent corrections, zero versus missing data, date/scope filters, separation from campaign analytics, and LinkedIn expiry behavior.

Status: complete locally on 2026-10-14. The additive migration, provider-scoped daily store, validation/read service, LinkedIn expiry handling, and isolated PostgreSQL cases passed. See [verification evidence](../../evidence/account-analytics-verification.md) and [ADR-012](../../decisions/ADR-012-connected-account-analytics.md).

### AAN-02 — OAuth and credential lifecycle

Implement authorization-code OAuth where the provider supports it, with server-side state/PKCE as required, callback origin allowlisting, least-privilege scopes, encrypted server-side token storage or a vetted secret reference, refresh/expiry handling, revocation/disconnect behavior, and safe reconnect states. Separate ordinary disconnect (stop sync, retain useful history) from an explicit data-deletion request; support provider/client deletion obligations, including LinkedIn's ten-day deletion deadline where applicable. Never accept tokens in ordinary UI forms or return them from APIs.

Acceptance: mock OAuth flows for state mismatch, replay, denial, expiry, refresh, disconnect, and credential non-disclosure; provider application registration and live consent remain conditional on stakeholder credentials/authorization.

### AAN-03 — Provider adapters and metric contracts

Implement the selected provider products individually. For each, record account type, API product/version, scopes, source fields, definitions/units, data grain, timezone/currency, rate limits, history limits, and provider retention. Keep paid, organic, content, and email-campaign scopes distinct. Do not map a provider field to an existing KPI without a documented semantic equivalence and golden case.

### AAN-04 — Connected-account dashboard

Make connected accounts the primary overview. Show connection state, last/next sync, provider-specific KPI summaries and daily trends, with account/platform/date filters and clear comparison rules. Keep campaign analytics available as a distinct view. Do not combine fields that have different meanings or currencies.

### AAN-05 — Preserve secondary CSV workflows

Keep current accepted CSV/spreadsheet behavior and import history accessible as a secondary path. Do not expand formats in this step. Clearly label manually imported campaign data versus provider-synced account data.

### AAN-06 — Sync health and PDF reporting

Automate provider-appropriate schedules using the existing PostgreSQL lease pattern. Show sync health, reconnect/permission errors, partial results, and recent run history. Generate date/platform/account-filtered PDFs from the same backend result as the dashboard. Define provider-specific retention/purge handling, explicit deletion-request workflows, and verify report parity.

### AAN-07 — Acceptance

Use sanitized fixtures and mock credentials for provider contract, correction, retry, missing/zero, pagination, rate-limit, scope, and retention cases. Before claiming live readiness, the stakeholder will provide API credentials and authorize real account access; compare source values with provider UI and document any product approval requirement.

## Current limitations to resolve

- Browser OAuth/token refresh is not yet implemented; the current integration slice uses operator-managed token references.
- Existing campaign integrations currently fetch campaign-level advertising data. Account and organic analytics require distinct adapter methods and contracts.
- Zoho campaign responses are cumulative snapshots and do not establish daily account totals.
- LinkedIn's one-year limit applies to Page and advertising reporting data. Older unmanaged campaign values may have ambiguous per-value provenance; review these before claiming full retention compliance.
- External deployment and live API verification remain separate, authorized release activities.
