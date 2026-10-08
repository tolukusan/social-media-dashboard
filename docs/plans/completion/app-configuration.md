# Application configuration follow-up — 2026-10-08

The stakeholder requested reporting currency in the app, development password-recovery delivery in logs, and a clear separation between implementation work and optional release checks.

## Bounded plan

1. Add a dedicated singleton `ReportingSettings` model and additive migration. Store one nullable reporting currency for the organisation; no generic settings builder or multi-tenancy. Validate supported uppercase ISO currency codes. Do not modify analytical amounts or targets.
2. Expose authenticated reporting-settings reads and Administrator-only updates, following permissions rule `PERM-005`. Retain existing session, Origin, and CSRF enforcement. Audit changes in the same transaction.
3. Add currency selection to the existing Administrator Settings screen. Read the persisted currency in backend analytics so dashboard and report consumers share it. Remove the obsolete environment template entry. Existing deployments must choose their current currency through Settings after migration; no currency is inferred or converted.
4. In explicit development mode, log the password-recovery recipient, link, and expiry instead of sending SMTP. Keep production/staging/unspecified modes on SMTP without recovery-message logging, and keep automated test capture silent.
5. Verify permissions, input validation, database constraints, persistence, unmodified amounts, report/dashboard parity, recovery delivery modes, and the Settings browser flow. Run the repository checks.
6. Clear `TODO.md` after successful implementation verification. Retain import provenance in `BLOCKERS.md`; move optional release checks to a release checklist. Do not claim SMTP inbox delivery, human review, participant testing, or external deployment occurred.

## Compatibility and recovery

API contract: `GET /api/v1/settings/reporting` requires a session and returns `reportingCurrency` (nullable) plus `availableCurrencies`. `PATCH /api/v1/settings/reporting` requires Administrator, allowed Origin, and CSRF, accepts `{ "reportingCurrency": "NGN" }` (any supported code), and returns the saved settings. Unknown fields, missing/null codes, lowercase codes, and unsupported values are rejected.

The new table has no foreign keys or changes to existing tables; its database constraints enforce one organisation row and currency-code shape. It starts unset until an Administrator selects a currency. The legacy `REPORTING_CURRENCY` environment value is ignored. Existing raw metrics, budgets, targets, formulas, and permission rules are preserved. Reverting the application change can leave the additive table in place; no destructive rollback is needed. Backups/restores include the table automatically.

The previous completion evidence remains historical. This request removes participant testing, human PDF review, and deployment from outstanding implementation acceptance; the release checklist records them only as optional or conditional activities.
