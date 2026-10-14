# Account-first connected analytics

## Product decision

The signed-in home view is **Accounts**. A social account can be connected and reported on without creating a campaign. Campaigns remain available for campaign planning and paid advertising results. Organic account analytics, paid campaign data, and email campaign reporting use separate data paths and labels.

## Screens and navigation

### 1. Accounts home

- The primary navigation opens on Accounts.
- The date range defaults to the latest 30 days in the workspace reporting timezone.
- Provider cards explain which account type can be connected, show whether the server has the required setup, and start OAuth when ready.
- The screen lists connected social accounts separately from Zoho email reporting.
- Users can select an account without being routed through Campaigns.

### 2. Provider authorization

- An Administrator or Marketing Officer starts the provider consent flow.
- The callback uses a short-lived, single-use OAuth state tied to the initiating user.
- The server exchanges the authorization code, discovers eligible accounts, encrypts tokens at rest, and requests current and previous 30-day data.
- Users return to Accounts with a result message. Tokens and provider secrets are never returned to the browser.

### 3. Social account dashboard

The dashboard answers these questions in order:

1. **How large is my audience and how did it change?** Provider audience totals and net growth are displayed when available. A first collected snapshot is a baseline, not historical growth.
2. **How much content activity did I receive?** A daily line chart shows the selected provider metric. The chart selector names the measurement directly.
3. **Which content performed best?** A ranked table links to the original item and labels lifetime measurements versus values for the selected period.
4. **Is performance changing?** KPI tiles compare the selected range with the immediately preceding range of equal length and show the absolute and percentage changes when both periods have data.
5. **Can I share the results?** Download PDF creates an account-level report with the period, KPI comparison, daily activity, top content, and metric caveats.

The Sync this period action fetches the selected range. Missing observations remain unavailable and are not filled with zero.

### 4. Email reports

Zoho appears in a separate email reporting section. The date filter selects campaigns by sent date. Summary cards and the table show the provider's cumulative campaign totals. The report does not represent those totals as daily activity or combine them with social metrics. Email reports can also be downloaded as PDF.

### 5. Campaigns and paid imports

The existing Overview is renamed Campaign overview and remains in navigation. Existing paid integrations and campaign reports are preserved in Integrations/Campaigns; account OAuth does not create or require a campaign.

## Metric boundaries

| Provider       | Account-level metrics                                                                           | Top content                                         | Scope and user-facing caveat                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instagram      | Followers, follower change from collected snapshots, views, reach, interactions                 | Recent media ranked by views                        | Business and Creator accounts linked to a Facebook Page. Views and reach have distinct meanings. Account insights are limited to the provider's available window; app retention is 90 days. |
| Facebook Pages | Followers, follower change from collected snapshots, Page visits, explicitly unpaid media views | Published posts with an explicitly unpaid breakdown | Paid or mixed media views are not presented as organic. If the API does not return an explicit unpaid value, the metric stays unavailable. This app retains Page data for up to 90 days.    |
| LinkedIn Pages | Organic follower gains, Page views, organic post impressions, unique impressions, clicks        | Organization posts ranked by organic impressions    | Admin role and API product approval are needed. Organic and paid analytics remain separate. Reporting data is retained for at most one year; post metadata is removed after six weeks.      |
| YouTube        | Subscribers, net subscriber change, views, watch time, likes                                    | Videos ranked by views in the selected range        | Requires the Google account to manage the channel and read-only YouTube API access. Recent provider data can be delayed.                                                                    |
| Zoho Campaigns | Sent, delivered, opens, unique clicks, bounces, unsubscribes                                    | Email campaigns                                     | Cumulative reports are selected by campaign sent date and remain separate from social data.                                                                                                 |

Metrics are not combined across providers because similar names can represent different provider definitions. Paid advertising stays in Campaigns; email stays in Email reports.

## Acceptance checks

- A new user can connect an eligible account and see its account dashboard without creating a campaign.
- A missing provider setup disables that provider's Connect action and explains that workspace setup is needed.
- Dashboard controls explain the selected period, previous-period comparison, sync freshness, and provider-specific limitations.
- Unsupported or missing metrics display as unavailable and do not become zero.
- The PDF uses the same account scope and period as the on-screen dashboard.
- Management can view data but cannot initiate OAuth, sync, or disconnect accounts.
