# Account provider setup

This application uses server-side OAuth. Add app credentials to the API environment only; do not paste provider client secrets or OAuth tokens into the browser, source control, support messages, or database fields. A connected user's access token is encrypted before it is stored.

## Shared setup

1. Copy `apps/api/.env.example` to `apps/api/.env` for local work, or create the equivalent secret environment variables in the API hosting environment.
2. Set `INTEGRATION_OAUTH_REDIRECT_URI` to the API callback URL and register the exact same URL in each OAuth app. Local default: `http://localhost:4000/api/v1/accounts/oauth/callback`.
3. Generate `INTEGRATION_TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`. Store it as a server secret and keep a secure backup. Changing or losing it makes existing encrypted connections unreadable and requires reconnecting accounts.
4. Set `APP_ORIGIN` to the web app origin. It is where the OAuth callback returns the user after processing.
5. Set `REPORTING_TIMEZONE` to the organisation's timezone.
6. Restart the API after changing environment settings. Provider cards report whether required settings are present; values themselves are never returned to the browser.

Do not use personal production credentials for local development. Use provider test users or a dedicated test account and an app configuration restricted to that account.

## Providers

| Provider       | Console work                                                                                                                                                                                                                                                       | API environment settings                                                                                   | Notes                                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram      | Create/configure a Meta app for Facebook Login and Instagram Graph access. Add the callback URL and test with a Business or Creator account linked to a Facebook Page. Request the required permissions and complete Meta review before serving external accounts. | `INTEGRATION_META_APP_ID`, `INTEGRATION_META_APP_SECRET`, `INTEGRATION_META_API_VERSION`                   | The same Meta app is used for Instagram and Facebook Pages. OAuth permissions requested by the app: `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`.                                        |
| Facebook Pages | Use the Meta app above, add the callback URL, and grant access from a Facebook user who has an eligible Page role. Complete the required permissions review for the intended users.                                                                                | `INTEGRATION_META_APP_ID`, `INTEGRATION_META_APP_SECRET`, `INTEGRATION_META_API_VERSION`                   | OAuth permissions requested: `pages_show_list`, `pages_read_engagement`, `read_insights`. Paid ads continue to use the existing campaign integration.                                                                                                   |
| LinkedIn Pages | Create a LinkedIn developer app, add the callback URL, apply for Community Management API access, and authorize with an organization administrator.                                                                                                                | `INTEGRATION_LINKEDIN_CLIENT_ID`, `INTEGRATION_LINKEDIN_CLIENT_SECRET`, `INTEGRATION_LINKEDIN_API_VERSION` | Use a currently supported Marketing API version formatted `YYYYMM`. The requested scopes include `rw_organization_admin` and `r_organization_social`; Marketwise currently invokes read endpoints only. LinkedIn API access approval is a prerequisite. |
| YouTube        | Create a Google Cloud project and OAuth consent configuration; enable YouTube Data API v3 and YouTube Analytics API; create an OAuth web client and add the callback URL. Add test users if the OAuth consent screen is in testing.                                | `INTEGRATION_GOOGLE_CLIENT_ID`, `INTEGRATION_GOOGLE_CLIENT_SECRET`                                         | Read-only scopes: `youtube.readonly` and `yt-analytics.readonly`. The user must be able to manage the authorized channel.                                                                                                                               |
| Zoho Campaigns | Create a Zoho OAuth client, register the callback URL, and select the organisation's Zoho data centre.                                                                                                                                                             | `INTEGRATION_ZOHO_CLIENT_ID`, `INTEGRATION_ZOHO_CLIENT_SECRET`, `INTEGRATION_ZOHO_REGION`                  | Region values supported by this application: `US`, `EU`, `IN`, `AU`, `JP`, `CN`. Scope: `ZohoCampaigns.campaign.READ`. Data remains in Email reports and is cumulative.                                                                                 |

## LinkedIn data handling

LinkedIn organization reporting data is limited to a rolling one-year range and the application deletes older stored daily metrics. Organization post text and post-level statistics are fetched and retained for no more than six weeks. Organization display metadata is cleared after eight weeks unless the user reconnects and refreshes it. The application does not call LinkedIn post creation or update endpoints. Confirm current LinkedIn product access, scopes, and storage requirements in the developer console and terms before enabling a production app.

## Environment values to provide at handoff

The project owner needs to add the following values to the API server environment, then restart the API:

- Shared: `INTEGRATION_OAUTH_REDIRECT_URI`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`
- Meta: app ID, app secret, and an active Graph API version
- LinkedIn: client ID, client secret, and an active Marketing API version
- Google: OAuth client ID and client secret
- Zoho: OAuth client ID, client secret, and data-centre region

Do not send the secret values in chat. Once the environment is configured, an Administrator or Marketing Officer can use **Accounts → Connect** to authorize a real account. Then verify a sync and compare a generated PDF against the provider dashboard before relying on it.

## Official provider documentation

- [Meta Instagram Platform](https://developers.facebook.com/docs/instagram-platform/)
- [Meta Graph API Page Insights](https://developers.facebook.com/docs/graph-api/reference/page/insights/)
- [LinkedIn Community Management API access](https://learn.microsoft.com/linkedin/marketing/increasing-access)
- [LinkedIn Posts API](https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api)
- [LinkedIn organization share statistics](https://learn.microsoft.com/linkedin/marketing/community-management/organizations/share-statistics)
- [YouTube Analytics API reports.query](https://developers.google.com/youtube/analytics/reference/reports/query)
- [YouTube Data API channels.list](https://developers.google.com/youtube/v3/docs/channels/list)
- [Zoho Campaigns API](https://www.zoho.com/campaigns/help/api/)

For installation on another system and the complete provider-console walkthrough, see [the step-by-step setup and migration guide](../guides/provider-setup-and-migration.md).
