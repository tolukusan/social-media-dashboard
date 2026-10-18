# ADR-012: Connected-account analytics and provider data retention

Date: 2026-10-14; updated 2026-10-18. Status: accepted; AAN-01 and the connected-account extension are implemented.

## Context

The existing dashboard stores daily values only under a local campaign-platform. That is unsuitable for Page, channel, video, or advertising-account reporting that is not attributed to a local campaign. Provider fields also do not share meaning merely because their labels look similar.

The stakeholder selected Facebook paid and organic Page analytics, Instagram paid and organic account analytics, LinkedIn ads and organic Page analytics, Zoho Campaigns email analytics, and YouTube channel and video analytics. Existing campaign analytics, supported CSV imports, KPI formulas, role boundaries, and the NestJS/PostgreSQL architecture remain in place.

LinkedIn's current Marketing API storage requirements allow one year for organization Page reporting data and advertising-account reporting data. The same requirements separately prohibit storing member profile/social data beyond shorter windows, which this performance-data slice does not ingest. The Marketing API terms also require deletion in ten days or less when a client stops receiving the relevant service and data is no longer needed, or upon the client's/account manager's request.

## Decisions

1. Store both campaign-integration and OAuth-connected-account observations in `ConnectedAccountAnalyticsRecord` and `ConnectedAccountMetricValue`, separate from campaign `PerformanceRecord` data. The record may reference an `IntegrationConnection` or a `ConnectedAccount`; it cannot reference both. OAuth observations use a stable source key for idempotent updates. `ACCOUNT` observations use a fixed account identity; `CONTENT` and `EMAIL_CAMPAIGN` observations retain a provider object ID and their reporting period or sent date.
2. Use system-managed `IntegrationMetricDefinition` rows keyed by provider, source metric code, and definition version. Persist the provider's raw measurement and source API version. Definitions carry provider-specific meaning, source field, unit, and aggregation strategy. Do not derive or combine account metrics across providers unless a later approved metric contract establishes equivalent semantics.
3. Keep Zoho's cumulative campaign totals in the same canonical record and metric-value tables under the distinct `EMAIL_CAMPAIGN` scope and `CUMULATIVE` data scope. Select reports by campaign sent date; never present cumulative totals as daily observations or combine them with social metrics.
4. Record value-level connection provenance for campaign integrations. This allows retention of provider-sourced metrics to be enforced without deleting unrelated campaign values in the same daily record.
5. Retention is defined per provider metric and enforced on each `ConnectedAccountMetricValue`. LinkedIn definitions must declare a retention period or ingestion is rejected. LinkedIn account reporting values expire 364 days after retrieval; LinkedIn content values expire after 42 days. Instagram and Facebook organic values expire after 90 days. Other providers currently have no local retention deadline in their metric definitions. Expired values are hidden immediately and deleted in the API-process retention sweep. The 364-day buffer is intentionally below the one-year maximum. Existing values in the former OAuth-specific tables are copied into the canonical tables with their provider scope and expiry before those tables are removed.
6. Ordinary OAuth disconnect stops synchronization, revokes the grant when supported and not shared, clears local credentials, and retains permitted historical analytics. Explicit data deletion is a separate Administrator action available after disconnect; it deletes the retained metric values, records, and account metadata and writes an audit event. Provider-specific deletion obligations override local retention. No token or credential value is stored in analytics tables.

## Consequences and limits

- Campaign KPIs remain in the existing backend calculation path; account observations do not enter campaign dashboards or PDF totals.
- OAuth account, content, and Zoho campaign reports use the approved AAN-01 analytics store; there is no second runtime analytics store. The provider adapters and reporting views remain separate from campaign-attributed analytics.
- LinkedIn's one-year rule applies to Page and advertising reporting values retrieved through the Marketing APIs. Content values use the shorter six-week app limit. Other data classes can have shorter or no-storage limits; member data is not supported by this analytics model. A value-level expiry is retained on every provider metric.
- The existing schema could not identify the origin of individual values in pre-migration campaign records that had already become unmanaged. The migration only backfills records still marked integration-managed. A data audit is required before claiming retention compliance for any older unmanaged LinkedIn-mapped values; they are not silently purged.
- The purge worker depends on the API process running. Expired values are hidden on reads even before deletion. Deployment operations must keep the worker available and monitor the safe retention-sweep warning.

## References

- [LinkedIn Marketing API data storage requirements](https://learn.microsoft.com/en-us/linkedin/marketing/data-storage-requirements?view=li-lms-2025-11)
- [LinkedIn Marketing API program terms](https://www.linkedin.com/legal/l/marketing-api-terms)
- [Connected-account analytics implementation plan](../plans/completion/connected-account-analytics.md)
