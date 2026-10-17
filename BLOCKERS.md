# Remaining product and release conditions

- **Import provenance:** Original import scope-promotion approval was not found in active plans/ADRs. Preserve the existing import feature and formats while the historical approval is located or formally resolved. This does not block the connected-account analytics work.

- **Live provider acceptance:** Instagram, Facebook Pages, LinkedIn Pages, YouTube, and Zoho Campaigns have account-first OAuth and analytics implementation, but no real provider account was authorized during local verification. The project owner must configure app credentials and required scopes/approvals, then validate syncs and reports/PDFs against eligible accounts. LinkedIn API access and its storage terms remain a production prerequisite. No provider secrets are checked in. See [provider setup](docs/integrations/account-provider-setup.md) and [account-first verification](docs/evidence/account-first-analytics-verification.md).

- **Sync recovery boundary:** Whole account/date-range retries are idempotent, but pagination has no durable page-level checkpoint; a failed range restarts from its first provider page. Provider response windows, top-content candidate limits, and Zoho's 400 recent-campaign/report cap are disclosed in report caveats. See [account-first verification](docs/evidence/account-first-analytics-verification.md).

- **Repository verification:** Current local checks pass: lint, typecheck, build, 95 unit tests, 64 isolated PostgreSQL/HTTP tests, and all 19 browser E2E journeys. These checks use local fixtures/mocks and do not establish live provider acceptance; detailed results are in [account-first verification](docs/evidence/account-first-analytics-verification.md).

Currency selection is now an Administrator-managed application setting. Local password recovery uses development logs. SMTP inbox delivery, human PDF review, participant testing, and deployment are optional or conditional [release checks](docs/guides/release-checklist.md), not outstanding implementation tasks.
