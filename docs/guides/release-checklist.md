# Optional release checks

Implementation work is tracked in [TODO](../../TODO.md), completed work in the [completion ledger](../plans/completion/README.md), and the remaining historical documentation question in [BLOCKERS](../../BLOCKERS.md).

The stakeholder removed human PDF review, participant testing, and external deployment from outstanding implementation acceptance on 2026-10-08. The activities below are optional or conditional release preparation, not coding blockers or claims of completed external verification.

- **Reporting currency:** an Administrator selects the organisation's operational currency in Settings. Existing amounts are labelled with that code without conversion. Currency is stored in PostgreSQL, not an environment variable.
- **Email delivery:** development recovery links appear in the API terminal with `NODE_ENV=development`, so local recovery requires no SMTP inbox. For a release using email recovery, configure the real SMTP provider and sender and verify delivery to a controlled inbox. No real delivery is claimed by local log-mode tests.
- **Human PDF review (optional):** inspect a long report for pagination, wrapping, charts, and extended characters in the intended viewer. Automated PDF rendering and download checks remain the recorded implementation evidence.
- **Participant usability testing (optional):** use the [prepared tasks](../evidence/usability-test-plan.md) if participant evaluation is desired. Record only genuine feedback.
- **External deployment (conditional):** use the [deployment runbook](deployment-runbook.md) when an environment is supplied and deployment is requested. No external deployment has been performed.
- **Import provenance:** resolve or formally document the old scope-promotion approval. Preserve existing formats and behavior while this historical question remains open.

Do not retain recovery links, passwords, SMTP credentials, or session tokens in release evidence.
