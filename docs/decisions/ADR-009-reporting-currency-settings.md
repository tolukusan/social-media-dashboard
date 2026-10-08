# ADR-009: Persist reporting currency in application settings

Date: 2026-10-08. Status: accepted by the stakeholder's request to configure currency in the app rather than the environment.

## Decision

Persist a single organisation-wide reporting currency in a dedicated `ReportingSettings` table in the existing PostgreSQL database. Administrators select an uppercase supported ISO currency code in Settings; all authenticated roles may read it. Backend enforcement follows `PERM-005`. Updates retain Origin/CSRF/session protections and are audited atomically.

Analytics reads the persisted code and supplies it to dashboard, charts, and reports. Currency is initially unset; do not infer a default. Changing the code changes labels for existing amounts, with an explanation on the Settings form. It does not perform exchange-rate conversion, support multiple currencies, or change KPI formulas.

## Consequences

An additive migration creates the singleton table and its constraints. Existing analytical tables and amounts are unchanged. `REPORTING_CURRENCY` is no longer an environment input; existing deployments should select their previous operational currency in Settings after migration. The approved one-currency-per-deployment semantics remain intact. This is the concrete persisted setting anticipated by the domain model's SystemSetting note, without introducing a generic settings system.

The [application configuration follow-up](../plans/completion/app-configuration.md) records scope and compatibility. Optional release acceptance is tracked separately from implementation work.
