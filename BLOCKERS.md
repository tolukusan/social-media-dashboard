# Documentation question

- **Import provenance:** Original import scope-promotion approval was not found in active plans/ADRs. Preserve the existing import feature and formats while the historical approval is located or formally resolved. This does not block independent implementation work.

- **Live integration activation:** The stakeholder selected campaign/advertising/performance scope and explicitly requested implementation before keys exist. Facebook Ads, Instagram Ads, LinkedIn Ads, and Zoho Campaigns are implemented locally. Provider tokens, developer permissions, supported API versions, and live account acceptance are pending. Zoho uses cumulative snapshots only; LinkedIn daily imports require UTC reporting boundaries. Additional providers are unnamed. See [the plan](docs/plans/completion/live-integrations.md) and [operator guide](docs/guides/integrations.md).

- **Repository verification:** Full lint fails on existing formatting in tracked `apps/api/scripts/local-campaign-cleanup.ts`; that unrelated file is preserved. The existing catalogue lifecycle browser test fails to find a newly created channel in two full-suite runs. Catalogue implementation was not changed; this separate failure requires scoped investigation before a clean full-suite claim. Integration-specific results are in [verification evidence](docs/evidence/live-integrations-verification.md).

Currency selection is now an Administrator-managed application setting. Local password recovery uses development logs. SMTP inbox delivery, human PDF review, participant testing, and deployment are optional or conditional [release checks](docs/guides/release-checklist.md), not outstanding implementation tasks.
