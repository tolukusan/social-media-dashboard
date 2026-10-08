# User Guide

## Sign in and account access

Open the web application and authenticate with an Administrator, Marketing Officer, or Management account. Sessions use secure, opaque cookies in production. **Forgot password?** sends a time-limited recovery link when email delivery is configured.

Under **My profile**, any signed-in user can update their display name or change their password. Changing the password requires the current password and signs out all active sessions so the user signs in again with the new password.

## Dashboard and analytics

Use the sidebar to switch screens; on a phone, open **Menu**. Workspace screens retain their selection when refreshed, and browser Back/Forward returns to previously visited screens. Keyboard users can use **Skip to content** to bypass navigation.

Overview requests KPI values from the API as filters change; no separate refresh button is required. On first opening, the date range covers the available active data. Campaign and dates are visible initially; **More filters** exposes channel, platform, metric, and an applicable target period. Active advanced filters are counted and the selected platform/metric scope is displayed. Available metrics provide useful initial results; an explicitly selected unavailable metric remains unavailable. Missing data is displayed as unavailable rather than zero. Analytics provides period comparison, campaign/channel comparison, and the same backend trend values used by Overview.

For Administrators and Marketing Officers, an empty Overview offers **Add your first data**, with **Enter manually** as an alternative. Returning users can choose **Add data** or **Download PDF** for the current filters. Management sees the read-only results journey. Data, Results, and Administration are grouped in the sidebar; My profile is beside your account details.

## Campaigns and performance

Administrators and Marketing Officers can create/update campaigns and enter raw daily performance values. Management is read-only. Only raw metrics applicable to the selected channel can be entered.

Performance data shows 50 records per page. Use **Previous records** and **Next records**, or search by campaign, channel, platform, or import name. Search and date filters apply to the full loaded list and return to the first matching page.

## Targets, imports, and reports

Administrators manage KPI targets. Targets use approved global, channel, platform, or campaign scope and cannot overlap for the same KPI/scope/period. When actual data is missing, target evaluation reports `NO_DATA`; when actual data exists but no target applies, it reports `NO_TARGET`.

Administrators and Marketing Officers can use **Imports** for **Upload file → Confirm details → Review and import → View results**. Recognised fields and deterministic mapping suggestions are selected for review. Change details only when needed, or create a missing campaign within the flow. Next checks the data; Import data commits it. Excluded rows require explicit acknowledgement. View results carries the accepted campaign/platform/date scope into Overview, where Download PDF uses the same filters. See the [import guide](imports.md). Management remains read-only.

Authenticated users can preview and download filtered reports. Administrators choose the organisation's reporting currency in Settings. Currency values use that saved code; until one is chosen, the UI explicitly says the currency is unset. Changing the code relabels existing amounts without converting them.
