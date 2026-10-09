# Live marketing integrations follow-up

Date: 2026-10-08. Status: locally implemented under the stakeholder's instruction to build campaign/advertising/performance integrations before API keys are available. Local verification results and repository blockers are recorded below; live access is pending credentials.

## Authorised objective

The stakeholder requested automatic imports from Instagram, Facebook, Zoho, LinkedIn, and additional providers. This explicitly requests future integration work beyond the completed MVP. It does not change metric formulas, role boundaries, campaign attribution, single-organisation deployment, or the approved NestJS/PostgreSQL architecture. Preserve existing manual entry and supported file imports.

This document bounds the requested work. The concrete initial implementation choices are recorded in [ADR-011](../../decisions/ADR-011-live-integrations.md). Follow [design amendment A-002](../../governance/design-amendments-v1.1.md), [permissions](../../product/permissions-matrix.md), [security](../../operations/security.md), and the [KPI catalogue](../../analytics/kpi-catalog.md).

## Inspected implementation

- `apps/api/src/imports/source-adapters.ts` detects file columns and suggests mappings. These adapters do not authenticate with providers or fetch live data.
- `apps/api/src/imports/imports.service.ts` validates campaign/platform/date/raw metrics, stages rows, handles existing-value conflicts, and commits imports. Reuse applicable validation and aggregation semantics; do not treat uploaded-file checksums as live-sync idempotency keys.
- `apps/api/prisma/schema.prisma` has no connected-account, OAuth-state, sync-run, or schedule persistence. Performance records are unique by campaign-platform/date, including archived rows. Existing records can originate from manual entry or file imports.
- `.env.example` has application/database/mail placeholders, with no provider configuration. Provider access availability has not been confirmed; no secret values were inspected.

## Inputs required before provider implementation

| Input                                                        | Why it matters                                                                                                       | Current state                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Facebook, Instagram, LinkedIn: organic, advertising, or both | Different API products, permissions, account types, and metric semantics                                             | Advertising/performance selected                                                |
| Zoho product                                                 | Campaigns, Social, and CRM require different adapters; CRM records cannot silently become approved marketing metrics | Zoho Campaigns implementation assumption stated to stakeholder                  |
| Additional provider names                                    | An extension interface cannot implement unnamed APIs                                                                 | No additional providers named; extension remains possible                       |
| Developer-app/API access status                              | Determines authentication flow and whether real acceptance testing is possible                                       | Keys unavailable; stakeholder explicitly authorised implementation without them |

Credentials belong in ignored local environment configuration or protected server-side credential storage, never in chat, commits, logs, or frontend responses. Register callback URLs against an authorised environment; this request does not authorise external deployment or app registration on the stakeholder's behalf.

## Proposed bounded implementation sequence

### INT-00 — Confirm source contracts

For each selected source, record account type, API product/version, read-only scopes, authorised account, available daily fields, timezone, currency, retention window, and pagination/rate-limit rules. Verify current official documentation and a sanitised response fixture. Select the first connector with usable access rather than assuming every provider is available.

Map only supported raw metrics with matching meanings. Views are not impressions; follower balance or net change is not followers gained; arbitrary clicks are not necessarily link clicks. Unsupported fields remain unavailable. Do not import provider rates as authoritative derived KPIs.

Define an explicit external-object-to-campaign-platform mapping. Page-level data must have a declared reporting scope and must not be duplicated across overlapping campaigns. Any requirement for analytics outside the campaign model needs a separate domain decision before implementation. Establish whether cumulative data can be obtained as genuine daily observations; do not distribute campaign totals over dates or invent deltas from incomplete snapshots.

Acceptance: exact provider list and supported field/date/attribution contracts are recorded, and access limitations are visible. Stop an affected adapter when a required daily metric or mapping is undefined.

### INT-01 — Connected accounts and security

Introduce `IntegrationConnection` under `Platform`, with provider/account identity, display name, source timezone, credential reference, lifecycle state, and sync metadata. Multiple accounts may belong to one platform. Never attach credentials to `Platform`.

Use additive migrations for connections, mappings, and sync runs. Preserve all existing records and relationships. Enforce identity and mapping constraints; deactivate/disconnect without deleting analytical history. OAuth-state storage is deferred with browser OAuth.

Apply existing system-configuration permissions: Administrators manage connection credentials, mappings, schedules, and disconnection. Marketing Officers operate permitted data imports. Management remains read-only. Document concrete endpoint permissions before implementation; retain existing backend guards and unsafe-request protections.

The implemented initial credential mechanism uses operator-managed, read-only OAuth access tokens referenced from server environment configuration. No raw token is persisted or accepted through the UI. Browser OAuth redirects, OAuth-state persistence, and token refresh are deferred; provider developer approval/credentials are unavailable. Require configuration before provider calls, redact provider errors, and separate local disconnection from provider token revocation. Setup remains usable without keys.

Acceptance: isolated migration/integrity tests, three-role HTTP authorization/Origin/CSRF tests, constrained credential-reference tests, and assertions that secrets never appear in responses or audit metadata. Browser OAuth tests do not apply to this initial operator-managed mechanism.

### INT-02 — First provider and manual sync

Implement one real, selected adapter and a Sync now flow. Bound request duration, response size, pagination, date windows, and retry/backoff. Use fixed provider origins; do not accept arbitrary fetch URLs. Record source scope, API version, run status, counts, and safe actionable errors.

Share backend validation with existing ingestion where appropriate. Stage conflicts rather than overwriting manual/file/archived records. Identical repeated imports must make no analytical change; retries and concurrent runs must not double-count. Provider corrections require a documented ownership/update rule before enabling automatic replacement. Preserve source lineage when multiple imports contribute metrics to one daily record.

Acceptance: sanitised provider fixtures, golden raw-value cases, missing/zero/date/timezone/currency cases, duplicate/concurrent/retry tests, archived/conflicting-record protection, and dashboard/report parity. A real authorised account must pass the operator-token-to-sync-to-analytics journey before claiming live verification.

### INT-03 — Automatic sync and remaining named providers

Persist schedules and work state in PostgreSQL within the modular monolith. Use database leases and durable retry state so multiple API processes and restarts cannot duplicate work. Do not add Redis, brokers, microservices, or another database. Define job attribution, cancellation/disconnection checks, lease recovery, and run retention before coding the runner.

Proposed initial cadence: daily completed-day imports, with a bounded correction window only where source semantics and ownership permit it. Make the last successful sync, next attempt, reconnect requirement, and partial failures visible. Each remaining named provider follows the same contract and acceptance gates; no placeholder adapter may report success.

Acceptance: restart/lease/retry/disconnection tests, a browser journey for connection and automatic import results, and provider-specific live evidence. Scheduling requires a running authorised application environment.

### INT-04 — Verification and handoff

Run formatting/lint, typecheck, relevant unit and isolated database/HTTP integration tests, API/web builds, and critical browser journeys. Apply verification migrations to a genuinely isolated test target. Prepare the existing local application with guarded additive migration/catalogue setup without resetting data. Update environment placeholders, operator documentation, permission/domain additions, a consequential-design ADR, completion ledger, and evidence with actual results.

Keep fixture-based verification distinct from live provider verification. Report unavailable credentials, denied API products, unsupported fields, and unverified connectors separately; do not present a settings screen as a working integration.

## Official documentation review

- [LinkedIn API quick start](https://learn.microsoft.com/en-us/linkedin/marketing/quick-start?view=li-lms-2026-08): API access must be requested for the relevant product. Organic/community and advertising access are separate choices.
- [Zoho Campaigns reports](https://www.zoho.com/campaigns/help/developers/campaign-reports.html): OAuth read scope and campaign-level report fields are documented. This alone does not establish daily observations or approve a metric mapping.
- Meta Instagram insights and Facebook Page insights documentation could not be retrieved during this review (fetch failure/rate limit). Recheck the selected API's official documentation before implementing a Meta adapter; no Meta endpoint/version/field contract is claimed verified here.

## Initial planning evidence (superseded by implementation)

Completed: task/documentation reconciliation, schema/import inspection, official-source prerequisite review, and this bounded plan. Application behaviour, tests, migrations, and environment configuration have not changed. Application verification is deferred until implementation.

Verification passed: `pnpm exec prettier --check docs/plans/completion/live-integrations.md docs/plans/completion/README.md TODO.md BLOCKERS.md`, `git diff --check`, and a PowerShell existence check of all 36 local Markdown links across these four files. No application tests, lint, typecheck, builds, or E2E were run for this documentation-only change.

## Current execution

The stakeholder subsequently clarified campaign/advertising/performance scope and explicitly instructed implementation despite unavailable keys. The initial local implementation adds the four named provider clients, connected accounts, explicit mappings, fenced PostgreSQL scheduling, safe missing-configuration states, advertising raw-value ingestion with provenance/ownership protection, cumulative Zoho snapshots, and the Integrations UI. It does not expand file formats or change KPI formulas. Source-day/currency mismatches block daily imports; additional providers and organic APIs are not claimed supported.

Current commands/results and limitations are tracked in [verification evidence](../../evidence/live-integrations-verification.md). The completed MVP baseline is not reopened, and live activation remains a conditional external-access activity.
