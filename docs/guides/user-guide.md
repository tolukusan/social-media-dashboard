# User Guide

## Sign in

Open the web application and authenticate with an administrator, marketing officer, or management account. Sessions use secure, opaque cookies in production.

## Dashboard

The Overview screen requests KPI values from the API. Choose a start and end date, then refresh. A dash means the selected period has no calculable value; missing data is not treated as zero.

## Campaigns and performance

Administrators and Marketing Officers can create/update campaigns and enter raw daily performance values. Management is read-only. Only raw metrics applicable to the selected channel can be entered.

## Targets and reports

Administrators manage KPI targets. Targets use approved global, channel, platform, or campaign scope and cannot overlap for the same KPI/scope/period. Authenticated users can request a filtered PDF report from `/api/v1/reports/dashboard.pdf`.
