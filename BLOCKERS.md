# Documentation question

- **Import provenance:** Original import scope-promotion approval was not found in active plans/ADRs. Preserve the existing import feature and formats while the historical approval is located or formally resolved. This does not block independent implementation work.

- **Connected account activation:** Instagram, Facebook Pages, LinkedIn Pages, YouTube, and Zoho Campaigns now have account-first OAuth and analytics implementation. The project owner must supply provider app credentials to the API server, secure the required provider approvals, and validate syncs/PDFs against real accounts. No secrets are checked in. LinkedIn API access and its storage terms remain a production prerequisite. See [provider setup](docs/integrations/account-provider-setup.md).

- **Repository verification:** Full lint fails on existing formatting in tracked `apps/api/scripts/local-campaign-cleanup.ts`; that unrelated file is preserved. The existing catalogue lifecycle browser test fails to find a newly created channel in two full-suite runs. Catalogue implementation was not changed; this separate failure requires scoped investigation before a clean full-suite claim. Integration-specific results are in [verification evidence](docs/evidence/live-integrations-verification.md).

Currency selection is now an Administrator-managed application setting. Local password recovery uses development logs. SMTP inbox delivery, human PDF review, participant testing, and deployment are optional or conditional [release checks](docs/guides/release-checklist.md), not outstanding implementation tasks.
