# Documentation questions and acceptance conditions

- **Import provenance:** Original import scope-promotion approval was not found in active plans or ADRs. Preserve the existing import feature and formats while the historical approval is located or formally resolved. This does not block independent implementation work.

- **Live provider acceptance:** Account OAuth, Instagram/Facebook/LinkedIn organic analytics, YouTube, and Zoho Campaigns are implemented locally using the canonical AAN-01 store. Real OAuth credentials, provider permissions, supported API versions, account eligibility, and comparison against provider reports remain pending. Zoho results remain cumulative email-campaign reports rather than daily observations. See the [account-first plan](docs/plans/completion/connected-account-analytics.md) and [verification evidence](docs/evidence/account-first-analytics-verification.md).

- **LinkedIn legacy-value retention review:** The new migration adds value-level provenance and backfills rows that are still connector-managed. Older LinkedIn-mapped campaign records that became unmanaged before this migration do not identify the source of each metric value. Audit those rows before claiming complete LinkedIn retention compliance; do not bulk-delete them without resolving their mixed/manual provenance. See [ADR-012](docs/decisions/ADR-012-connected-account-analytics.md).

- **Browser verification:** `pnpm lint`, typecheck, unit tests, and PostgreSQL/HTTP integration tests passed for this reconciliation. E2E setup built the web app and started the API, but all 19 cases stopped before assertions because the Playwright Chromium executable is absent. The existing catalogue lifecycle browser test also failed in two earlier full-suite runs. See [current verification evidence](docs/evidence/account-first-analytics-verification.md).

Currency selection is now an Administrator-managed application setting. Local password recovery uses development logs. SMTP inbox delivery, human PDF review, participant testing, and deployment are optional or conditional [release checks](docs/guides/release-checklist.md), not outstanding implementation tasks.
