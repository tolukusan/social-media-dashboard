# Connected-account analytics implementation plan

Date: 2026-10-14; updated 2026-10-18. Status: AAN-01/02/03/04/06 are implemented locally; live provider acceptance remains conditional on credentials and account access.

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

Create a provider-scoped daily observation store linked to `IntegrationConnection`, not `CampaignPlatform`. Extend that canonical store for OAuth-connected accounts without adding a parallel analytics store. Preserve provider metric identity, meaning, units, aggregation strategy, source API version, account/content scope, and value-level retention metadata. Expose authenticated read and ingestion paths without changing campaign dashboard totals.

Acceptance: additive migration; isolated database tests for uniqueness, foreign keys, source/value validation, idempotent corrections, zero versus missing data, date/scope filters, separation from campaign analytics, and LinkedIn expiry behavior.

Status: complete locally on 2026-10-14. The additive migration, provider-scoped daily store, validation/read service, LinkedIn expiry handling, and isolated PostgreSQL cases passed. See [verification evidence](../../evidence/account-analytics-verification.md) and [ADR-012](../../decisions/ADR-012-connected-account-analytics.md).

### AAN-02 — OAuth and credential lifecycle

Implement authorization-code OAuth where the provider supports it, with server-side state/PKCE as required, callback origin allowlisting, least-privilege scopes, encrypted server-side token storage or a vetted secret reference, refresh/expiry handling, revocation/disconnect behavior, and safe reconnect states. Separate ordinary disconnect (stop sync, retain useful history) from an explicit data-deletion request; support provider/client deletion obligations, including LinkedIn's ten-day deletion deadline where applicable. Never accept tokens in ordinary UI forms or return them from APIs.

Acceptance: mock OAuth flows for state mismatch, replay, denial, expiry, refresh, disconnect, and credential non-disclosure; provider application registration and live consent remain conditional on stakeholder credentials/authorization.

Status: implemented locally. OAuth credentials are encrypted at rest; account discovery, state consumption, refresh, revocation where supported, and safe reconnect are covered. Disconnect clears credentials and stops sync while retaining permitted analytics. An Administrator can explicitly delete data after disconnect.

### AAN-03 — Provider adapters and metric contracts

Implement the selected provider products individually. For each, record account type, API product/version, scopes, source fields, definitions/units, data grain, timezone/currency, rate limits, history limits, and provider retention. Keep paid, organic, content, and email-campaign scopes distinct. Do not map a provider field to an existing KPI without a documented semantic equivalence and golden case.

Status: implemented locally. Instagram, Facebook, LinkedIn, YouTube, and Zoho observations use provider-specific AAN-01 definitions and canonical record/value tables. Zoho reports use the distinct `EMAIL_CAMPAIGN` scope and remain cumulative.

### AAN-04 — Connected-account dashboard

Make connected accounts the primary overview. Show connection state, last/next sync, provider-specific KPI summaries and daily trends, with account/platform/date filters and clear comparison rules. Keep campaign analytics available as a distinct view. Do not combine fields that have different meanings or currencies.

Status: implemented locally. Accounts, comparisons, and individual reports work without campaign creation; disconnected accounts remain readable within retention.

### AAN-05 — Preserve secondary CSV workflows

Keep current accepted CSV/spreadsheet behavior and import history accessible as a secondary path. Do not expand formats in this step. Clearly label manually imported campaign data versus provider-synced account data.

Status: existing CSV workflows and campaign reporting remain available alongside the Accounts view.

### AAN-06 — Sync health and PDF reporting

Automate provider-appropriate OAuth account refreshes while preserving the existing PostgreSQL lease pattern for campaign integrations. Show sync health, reconnect/permission errors, and partial results. Generate date/account-filtered PDFs from the same backend result as the dashboard. Define provider-specific retention/purge handling, explicit deletion-request workflows, and verify report parity.

Status: implemented locally. Daily sync, comparison export, PDF reports, metric-level expiry, disconnect retention, and separate post-disconnect deletion are covered by automated tests. Live provider access remains unverified.

### AAN-07 — Acceptance

Use sanitized fixtures and mock credentials for provider contract, correction, retry, missing/zero, pagination, rate-limit, scope, and retention cases. Before claiming live readiness, the stakeholder will provide API credentials and authorize real account access; compare source values with provider UI and document any product approval requirement.

## Remaining acceptance conditions

- Live OAuth consent, account eligibility, and provider values have not been verified with real provider credentials.
- The OAuth account refresh loop is process-scheduled and idempotent but does not use a durable per-account lease across multiple API instances.
- Zoho campaign responses remain cumulative snapshots and do not establish daily account totals.
- Older unmanaged LinkedIn campaign values may have ambiguous per-value provenance; review those before claiming full retention compliance.
- External deployment and live API verification remain separate, authorized release activities.
