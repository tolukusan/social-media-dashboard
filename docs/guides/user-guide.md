# User Guide

For a consolidated guide to the current file-first campaign screens, column-detail saving, joined-date exports, connected-account reports and access approval, start with the [Marketwise user guide](../../project-documentation/USER_GUIDE.md). The structured KPI import instructions below describe the separate canonical performance workflow; file datasets do not automatically populate those KPIs.

## Sign in and account access

Open the web application and authenticate with an Administrator, Marketing Officer, or Management account. Sessions use secure, opaque cookies in production. **Forgot password?** sends a time-limited recovery link when email delivery is configured.

Under **My profile**, any signed-in user can update their display name or change their password. Changing the password requires the current password and signs out all active sessions so the user signs in again with the new password.

## Dashboard and analytics

Use the sidebar to switch screens; on a phone, open **Menu**. Workspace screens retain their selection when refreshed, and browser Back/Forward returns to previously visited screens. Keyboard users can use **Skip to content** to bypass navigation.

Overview requests KPI values from the API as filters change; no separate refresh button is required. On first opening, the default campaign date range ends at the latest eligible record and includes its preceding 29 calendar days; explicit dates are preserved. Campaign and dates are visible initially; **More filters** exposes channel, platform, metric, and an applicable target period. Active advanced filters are counted and the selected platform/metric scope is displayed. Available metrics provide useful initial results; an explicitly selected unavailable metric remains unavailable. Missing data is displayed as unavailable rather than zero. Analytics provides period comparison, campaign/channel comparison, and the same backend trend values used by Overview.

For Administrators and Marketing Officers, an empty Overview offers **Add your first data**, with **Enter manually** as an alternative. Returning users can choose **Add data** or **Download PDF** for the current filters. Management sees the read-only results journey. Data, Results, and Administration are grouped in the sidebar; My profile is beside your account details.

## Campaigns and performance

Administrators and Marketing Officers can create/update campaigns and enter raw daily performance values. Management is read-only. Only raw metrics applicable to the selected channel can be entered.

Performance data shows 50 records per page. Use **Previous records** and **Next records**, or search by campaign, channel, platform, or import name. Search and date filters apply to the full loaded list and return to the first matching page.

## Targets, imports, and reports

Administrators manage KPI targets. Targets use approved global, channel, platform, or campaign scope and cannot overlap for the same KPI/scope/period. When actual data is missing, target evaluation reports `NO_DATA`; when actual data exists but no target applies, it reports `NO_TARGET`.

Administrators and Marketing Officers can use **Imports** for **Upload file → Confirm details → Review and import → View results**. Recognised fields and deterministic mapping suggestions are selected for review. Change details only when needed, or create a missing campaign within the flow. Next checks the data; Import data commits it. Excluded rows require explicit acknowledgement. View results carries the accepted campaign/platform/date scope into Overview, where Download PDF uses the same filters. See the [import guide](imports.md). Management remains read-only.

Authenticated users can preview and download filtered reports. Administrators choose the organisation's reporting currency in Settings. Currency values use that saved code; until one is chosen, the UI explicitly says the currency is unset. Changing the code relabels existing amounts without converting them.

## Workspace navigation and dates

Overview opens after sign-in and shows imported/manual campaign performance. Accounts contains connected-account insights, comparison, email reports, and Connections. Campaigns contains campaign management, campaign analytics, and KPI targets. Data contains Imports and Performance data. Reports exposes campaign, date, channel, platform, and metric filters. Administration contains Settings, Users, and Archive for Administrators.

The default campaign period is the latest eligible record date and its preceding 29 calendar days. With no eligible records it uses today in the reporting timezone (UTC when unconfigured). Explicit dates, including a partially filled range, are preserved. Choose a trend metric to investigate available channel metrics. Reports omit unavailable metrics by default; select Include unavailable metrics when needed. Zero is a valid value.

## Archive, restore, and permanent deletion

Existing campaign and performance Delete actions archive data. Archived records and records of archived campaigns leave normal campaign analytics and exports. In Administration → Archive, search Campaigns or Performance records and restore an item. Restore a parent campaign before individually archived records; restoring a campaign does not restore individually archived records.

Review deletion loads current dependency counts and blockers from the server. Remove listed campaign mappings through Accounts → Connections first; a running synchronization must finish before mapping removal. Mapping removal preserves historical records. Permanent deletion requires typing the exact displayed identity within five minutes. Any changed dependency requires a new preview. This action cannot be undone. Import source rows, batch history, duplicate-file protection, and audits remain. Previously deleted daily keys cannot be recreated by automatic import/sync; deliberate manual entry remains possible.

## Apply for access and invite users

Request workspace access from the sign-in page, enter your name, email, and password, and wait for Administrator approval. Submitting an application never grants workspace access or Administrator status. Existing users should use sign-in/password recovery. This deployment continues to use its existing seeded Administrator setup.

Administrators review applications in Administration → Users, explicitly choose an existing role, and approve or reject. Approval preserves the applicant's chosen credentials. Existing user creation and role management remain available.

To invite someone without a pending application, choose their role and email in Users, create an invitation, and copy its link for manual delivery. Deliver it privately; the application does not send email. Links expire after seven days and can be revoked before use. The recipient enters the invited email, name, and a password, then signs in. Each link works once. Existing accounts cannot be replaced by invitations.
