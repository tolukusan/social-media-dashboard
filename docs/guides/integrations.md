# Marketing integrations

The Integrations workspace supports Facebook Ads, Instagram Ads, LinkedIn Ads, and Zoho Campaigns. You can prepare setup before credentials exist. Additional providers need a specific adapter; an arbitrary API URL is not supported.

## Prepare setup

1. As an Administrator, ensure the appropriate platform exists in Settings: Facebook Ads, Instagram Ads, or LinkedIn Ads under Online Advertising; Zoho Campaigns under Email Marketing. The normal seed includes these catalogue entries.
2. Create a local campaign using that platform, with appropriate dates and a responsible user.
3. Open **Integrations**, select the provider/platform, enter a connection name, external account ID, source timezone, and advertising account currency. For Zoho choose the account's supported data region.
4. Use a server token reference such as `INTEGRATION_META_ACCESS_TOKEN`. Save the connection. **Awaiting server access token** is expected until the operator configures credentials.
5. Select the connection, map each external campaign ID to the appropriate local campaign-platform, and optionally enable daily sync. Each external campaign and each local campaign-platform can be mapped once within the enforced boundaries. Configure a new connection rather than silently rebinding existing provenance.

This application reads performance; it does not create or modify campaigns, advertisements, contacts, or messages on provider services. Local campaigns remain explicit organisational reporting contexts.

## Operator activation

Apply the additive migration with the normal application migration procedure and generate the Prisma client. Run the idempotent seed if the new platform catalogue entries are needed. Do not reset a database. Keep provider secrets in the API's ignored environment configuration, using [.env.example](../../.env.example) as a placeholder reference.

For the existing local deployment, `pnpm --filter @smd/api integrations:prepare-local` applies pending additive migrations and creates only missing provider platforms. It refuses non-loopback databases or a URL without the explicit `social_media_dashboard` schema and preserves existing catalogue customisations. Use the normal deployment runbook for any external environment. Provider placeholders also exist in [the API environment example](../../apps/api/.env.example).

| Provider                 | Server token reference              | Additional configuration and access                                                                                  |
| ------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Facebook / Instagram Ads | `INTEGRATION_META_ACCESS_TOKEN`     | `INTEGRATION_META_API_VERSION`, a supported `vN.N` version; approved read access to the advertising account          |
| LinkedIn Ads             | `INTEGRATION_LINKEDIN_ACCESS_TOKEN` | `INTEGRATION_LINKEDIN_API_VERSION`, a supported `YYYYMM` version; `r_ads_reporting` and account/campaign read access |
| Zoho Campaigns           | `INTEGRATION_ZOHO_ACCESS_TOKEN`     | `ZohoCampaigns.campaign.READ`, token issued for the selected data centre                                             |

These are provider OAuth access tokens, not arbitrary API-key strings. Acquire them through each provider's authorised developer setup. No application OAuth sign-in or automatic refresh is included in this initial operator-managed configuration. Expired or revoked tokens require operator replacement and API restart. Tokens are never entered into the web form; only their configuration names are stored. Separate account-specific references ending in `_ACCESS_TOKEN` can be used.

Restart the API after supplying environment configuration. **Server credentials configured** means the values are present; it does not mean the provider accepted them. Verify a short range with **Sync now**, inspect run history, and compare provider totals before enabling routine operation.

An Administrator can update the token reference under a connection's **Server configuration** section. Currency and source timezone can be corrected before daily data is imported; afterwards those meanings are protected to preserve history. Keep account identities and campaign mappings stable.

The API runs a scheduler every minute when `INTEGRATIONS_SCHEDULER_ENABLED` is not `false`. Daily runs revisit the previous seven completed source-calendar days. The application must remain running. Failures/configuration problems back off for an hour and appear in run history. No background infrastructure or paid service was installed.

## Read results safely

Manual sync accepts at most 31 completed source-calendar days. Advertising account currency must match reporting currency in Settings. No currency conversion occurs. Meta's returned currency and timezone are checked against connection configuration. Source timezone must match the deployment reporting timezone for daily imports. LinkedIn advertising reporting uses UTC, so its daily import stays blocked in a deployment using a different reporting timezone; do not change existing reporting-day semantics merely to activate a connector.

Advertising imports create daily raw impressions, clicks, and spend. Dashboards and PDF reports use the existing backend KPI calculations. Missing rows/fields remain missing. Existing manual/file records, manual corrections, and archived records are preserved and counted as conflicts. Connector-owned active records can receive late provider corrections; identical repeats make no change. Manual edits retain source provenance but prevent later connector updates.

Zoho snapshots show cumulative campaign counts as observed at the run time. Repeated snapshots are historical observations, not extra daily activity. They do not populate daily charts, targets, or PDF KPIs. Provider percentages and rates are excluded. Organic Facebook/Instagram profile metrics are not included in these advertising connectors.

**Disconnect** stops local scheduling and fences pending writes while preserving mappings, runs, and performance history. It does not revoke an environment token shared with other connections. Revoke tokens in the provider's tools when required. **Resume connection** reactivates setup; daily scheduling must be enabled separately.

## Official references and verification limits

- [Meta-maintained Marketing API collection](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi): advertising insights request fields and daily partitioning. Meta's direct developer documentation was rate-limited during development; confirm the chosen API version before live activation.
- [LinkedIn advertising reporting](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ads-reporting?view=li-lms-2026-08) and [reporting timezones](https://www.linkedin.com/help/lms/answer/a420851): reporting API and UTC date boundaries.
- [Zoho campaign reports](https://www.zoho.com/campaigns/help/developers/campaign-reports.html) and [data centres](https://www.zoho.com/campaigns/help/developers/data-centers.html): cumulative report response and supported provider origins.

Developer apps, permissions, account-specific metric availability, and real network journeys remain unverified until credentials are supplied. Automated [verification evidence](../evidence/live-integrations-verification.md) uses synthetic provider fixtures and an isolated local database.
