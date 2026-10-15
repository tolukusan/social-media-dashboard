# ADR-012: Connected-account analytics and provider data retention

Date: 2026-10-14. Status: accepted for the stakeholder-authorised connected-account redesign; AAN-01 implemented locally.

## Context

The existing dashboard stores daily values only under a local campaign-platform. That is unsuitable for Page, channel, video, or advertising-account reporting that is not attributed to a local campaign. Provider fields also do not share meaning merely because their labels look similar.

The stakeholder selected Facebook paid and organic Page analytics, Instagram paid and organic account analytics, LinkedIn ads and organic Page analytics, Zoho Campaigns email analytics, and YouTube channel and video analytics. Existing campaign analytics, supported CSV imports, KPI formulas, role boundaries, and the NestJS/PostgreSQL architecture remain in place.

LinkedIn's current Marketing API storage requirements allow one year for organization Page reporting data and advertising-account reporting data. The same requirements separately prohibit storing member profile/social data beyond shorter windows, which this performance-data slice does not ingest. The Marketing API terms also require deletion in ten days or less when a client stops receiving the relevant service and data is no longer needed, or upon the client's/account manager's request.

## Decisions

1. Store provider-account observations in `ConnectedAccountAnalyticsRecord` and `ConnectedAccountMetricValue`, separate from campaign `PerformanceRecord` data. Account records use source-calendar daily dates. `ACCOUNT` observations use a fixed account identity; `CONTENT` observations retain a provider object ID for scopes such as YouTube videos.
2. Use system-managed `IntegrationMetricDefinition` rows keyed by provider, source metric code, and definition version. Persist the provider's raw measurement and source API version. Definitions carry provider-specific meaning, source field, unit, and aggregation strategy. Do not derive or combine account metrics across providers unless a later approved metric contract establishes equivalent semantics.
3. Keep Zoho's existing cumulative campaign snapshots outside daily account analytics until a verified report-period contract is selected. A cumulative campaign total is not a daily observation.
4. Record value-level connection provenance for campaign integrations. This allows retention of provider-sourced metrics to be enforced without deleting unrelated campaign values in the same daily record.
5. Retention is defined per provider metric. LinkedIn reporting definitions must declare a retention period or ingestion is rejected. Current advertising metrics expire 364 days after each successful retrieval; future content metrics can declare shorter limits. Expired values are hidden immediately from analytics and deleted in an API-process retention sweep. The 364-day buffer is intentionally below the one-year maximum. On process startup the sweep runs immediately, then every minute. Existing active integration-managed campaign values are backfilled from their connection; the migration does not delete data.
6. Disconnecting a connection preserves historical analytics unless a provider/contract-specific deletion rule applies. No token or credential value is stored in these tables.

## Consequences and limits

- Campaign KPIs remain in the existing backend calculation path; account observations do not enter campaign dashboards or PDF totals.
- The first slice provides account-level storage, ingest validation, and a read endpoint. It does not claim that OAuth or any organic/YouTube provider adapter is implemented.
- LinkedIn's one-year rule applies to Page and advertising reporting values retrieved through the Marketing APIs. Other data classes can have shorter or no-storage limits; member data is not supported by this analytics model. A value-level expiry is kept through manual edits that leave its source metric intact; replacing all values with manual entry creates manual values without LinkedIn provenance.
- The existing schema could not identify the origin of individual values in pre-migration campaign records that had already become unmanaged. The migration only backfills records still marked integration-managed. A data audit is required before claiming retention compliance for any older unmanaged LinkedIn-mapped values; they are not silently purged.
- The purge worker depends on the API process running. Expired values are hidden on reads even before deletion. Deployment operations must keep the worker available and monitor the safe retention-sweep warning.

## References

- [LinkedIn Marketing API data storage requirements](https://learn.microsoft.com/en-us/linkedin/marketing/data-storage-requirements?view=li-lms-2025-11)
- [LinkedIn Marketing API program terms](https://www.linkedin.com/legal/l/marketing-api-terms)
- [Connected-account analytics implementation plan](../plans/completion/connected-account-analytics.md)
