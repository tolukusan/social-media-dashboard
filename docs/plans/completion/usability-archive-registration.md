# Usability, registration, and administrator archive lifecycle

Date: 2026-10-18. Owner: Codex Cloud implementation handoff.

Status: implementation completed on the feature branch; final verification and review are recorded in [execution evidence](../../evidence/usability-archive-registration-verification.md). Do not merge directly into main.

## Start here and Cloud prerequisites

Read AGENTS.md, .ai/LOCAL_OPERATING_RESTRICTIONS.md, the completion README, and relevant security, analytics, database, permissions, and architecture documentation. Apply the repository security-change, database-change, and analytics-change skills where relevant. The plan below records stakeholder decisions, including the explicit exception to archive-only policy; implement and document that exception rather than applying it to other entities.

Base: main at aabad94c3732bc11ba95a91ab90fbcb799705d2c. Existing OAuth integrations and dashboard redesign are already committed in that base. The local web-server restart was a runtime repair, not an uncommitted source change.

Use Node.js 24, pnpm 11.8.0 (packageManager), the committed lockfile, and PostgreSQL 18 with the explicit application schema. Install with `pnpm install --frozen-lockfile` and generate Prisma with `pnpm db:generate`. Follow repository deployment/test guidance for migrations and isolated test databases; never reset a shared database. Use the checked-in environment templates to discover configuration names, and supply values only through ignored environment files or Cloud-managed secrets. Cloud does not inherit local credentials, database contents, processes, ngrok tunnels, browser sessions, or Windows playbook files. Repository guidance and this document must suffice; report any genuinely unavailable prerequisite rather than inventing it.

Do not copy credentials, test passwords, tokens, or environment files into Git or handoff text. Live provider consent needs authorised account-owner action; mocked integration verification does not prove live consent. Recheck tunnel activity and exact callback routes before any future live configuration. Preserve minimum read-only scopes, state, PKCE where implemented, encryption, and administrator controls.

## Delivery order

1. Correct archive/restore backend lifecycle and verify analytical exclusion.
2. Complete dependency analysis, policy ADR, and safe permanent-delete endpoints; verify concurrency and rollback.
3. Build the consolidated interface, Archive, defaults, and matching report preview/PDF behaviour around verified endpoints.
4. Implement registration, approval, and invitations with additive migrations and security verification.

The original handoff contained no implementation. The following approved requirements now describe the implemented scope; the registration correction below supersedes the original bootstrap proposal.

## 1. Archive and restore correctness

- Share a backend eligibility rule: normal campaign analytics include only ACTIVE performance records whose parent campaign has archivedAt null. Apply it to PerformanceService.list(), buildDashboardWhere(), dashboards, totals, trends, comparisons, reports, PDF data, and default-date discovery. Audit all paths, not only these entry points.
- Campaign archival hides its dependent data without changing individual record states. Campaign restoration returns visibility only to records that remain active.
- Record archive sets status ARCHIVED and archivedAt; restore sets ACTIVE and clears archivedAt. Update attribution and audit both operations.
- Backfill missing archive timestamps from matching archive audit events where available. Otherwise show “Archive date unavailable”; do not invent dates.
- Block restoring a record while its campaign is archived, explaining that the campaign must be restored first.
- Preserve the existing unique constraint on (campaignPlatformId, recordDate), including archived records. Do not introduce partial uniqueness or duplicate active/archive rows.
- Add administrator-only archive lists and restore endpoints. Preserve existing DELETE /campaigns/:id and DELETE /performance-records/:id as archive operations for compatibility.
- Verify lifecycle correctness before implementing permanent deletion.

## 2. Permanent deletion and dependencies

Policy: only administrators may permanently delete already archived campaigns or performance records, from Archive. Restore remains available until deletion. No automatic purge or waiting period. This scope does not add deletion of users, catalogues, imports, or connected accounts.

| Dependency                                                  | Campaign deletion                                                            | Record deletion                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| Performance records and metric values                       | Delete all dependent records/values, including individually archived records | Delete selected record and values  |
| Campaign-scoped KPI targets                                 | Delete                                                                       | Retain                             |
| Campaign-channel/platform associations                      | Delete after dependants                                                      | Retain                             |
| Shared channels/platforms/metric definitions/global targets | Retain                                                                       | Retain                             |
| Import batches and rows                                     | Retain unchanged as provenance                                               | Retain unchanged as provenance     |
| Audit history                                               | Retain and append deletion summary                                           | Retain and append deletion summary |
| Integration connections and account analytics               | Retain                                                                       | Retain                             |

- Inventory every foreign key and service reference before coding deletion. Resolve all relations explicitly; the table is not permission to ignore other dependencies.
- Block deletion while an integration mapping references the campaign context or selected record. Identify the connection/mapping and explain the required action.
- If existing controls cannot remove a mapping safely, add explicit administrator mapping removal. Stop ingestion for that mapping, coordinate queued/running syncs, preserve existing records/provenance, and leave unrelated mappings/connections intact. Audit necessary detachment before removing a restrictive mapping reference.
- Ingestion must recheck mapping existence and campaign eligibility before writes using the same transaction/locking discipline as removal/deletion. Stale sync state must not recreate deleted records.
- Keep completed imports, source rows, statuses, and duplicate-import safeguards. Retained provenance must not imply an import never happened.

### Authoritative confirmation and transactions

- Add administrator-only preview endpoints and separate permanent-delete endpoints under /api/v1. Preview supplies identity, affected counts, blockers, required typed text, and a short-lived opaque confirmation reference.
- Persist only a hash of the reference, bound to administrator, entity, expiry, and dependency/version fingerprint. Use a five-minute expiry and single use.
- Delete requires the reference and typed confirmation. In one transaction, lock and revalidate archived state, dependencies, fingerprint, text, actor binding, and expiry before deleting. Recheck role through current backend authorization.
- Dependent writers must share parent/context locking so dependencies cannot change after validation. A stale preview returns 409 and requires a fresh preview; no partial deletion. Lock in a deterministic order to avoid deadlocks.
- Campaign text is the displayed name; record text is the displayed identifier. Enforce matching on the server.
- Delete in explicit foreign-key-safe order; retain restrictive foreign keys rather than adding broad cascades.
- Audit actor, entity identifiers, timestamp, affected counts, and retained import identifiers. Exclude raw source rows, secrets, and unnecessary personal data.
- Add a new ADR superseding archive-only policy only for these entities through the administrator Archive workflow. Document permanent deletion, dependency handling, audit retention, and no automatic purge; update lifecycle/permission/operations guidance.

## 3. Usability, navigation, dates, and reports

- Exactly six primary navigation items: Overview, Accounts, Campaigns, Data, Reports, Administration. Put account insights/comparison/email reporting/connection administration in Accounts internal navigation; imports/performance entry in Data; campaign analytics/KPI targets in Campaigns; settings/users/admin-only Archive in Administration internal navigation. Preserve existing URL/hash destinations, Back/Forward, and role access.
- Preserve existing URL/hash destinations with aliases, Back/Forward behaviour, and role restrictions. Keep the established blue-accent visual direction and existing domain workflows.
- Land on campaign Overview. Clearly distinguish imported/manual campaign data from connected-account analytics, especially when zero accounts are connected but imported records exist.
- Default campaign range ends on the most recent eligible record from an unarchived campaign and includes the preceding 29 calendar days. Use configured reporting-timezone calendar arithmetic and date-only semantics: latest October 10 means September 11–October 10, even on October 18.
- Never overwrite explicitly selected dates, including partially specified ranges. With no eligible records, use today in the reporting timezone and its preceding 29 days with a clear empty state. Connected social and Zoho reporting retain their separate date semantics.
- Show no more than four available headline metrics in each Social or Email group. Put Engagements first for Social and Opens first for Email, then use the existing configured metric order. Keep missing metrics unavailable, preserve valid zeros, and retain the explicit trend selector.
- Simplify provider cards to provider, eligibility, readiness, and one action; reveal technical setup details on demand. Compare with fewer than two eligible accounts explains the requirement and offers Connect accounts.
- Reports exposes campaign/date/channel/platform/metric filters directly and preserves them across preview/download.
- Add includeUnavailableMetrics, default false, to report requests. Backend report assembly applies it consistently to preview and PDF; presentation filtering does not change calculations. Do not implement this only in React.
- Archive has server-paginated Campaigns and Performance records tabs with server-side search, deterministic ordering, page controls, archive dates, restore, and authoritative deletion previews. Distinguish individual archival from being hidden by parent archival.

## 4. Registration and access requests

- One organization per deployment. Retain the existing seeded Administrator setup and all existing users and roles. Public applicants always require Administrator approval; no registrant automatically becomes Administrator. No first-user bootstrap flow, organizations model, platform administrator, multi-tenancy, subscriptions, or billing.
- Provision required fixed role reference data through deployment migrations, without depending on a demo/user seed. Preserve existing reference identities and users.
- All installations offer public signup as pending access requests. Applicants set credentials but receive no workspace access until an administrator approves and assigns an approved role. Model pending/approved/rejected requests explicitly without conflating them with existing active/deactivated accounts.
- Provide administrator approval/rejection and invitations bound to email and chosen role. Invitation links expire after seven days, are single-use and revocable, and are copied for manual delivery; no mail service is required.
- Recipients set their name/password. Bind acceptance to invited email and prevent existing-account takeover; direct existing users to login/recovery. Pending requests require explicit admin resolution rather than silently replacing credentials.
- Store invitation-token hashes only. The initial authorised administrator response may supply the copyable link; never log it. Prevent URL tokens entering referrers/analytics.
- Reuse password validation, Argon2id, session creation, CSRF/origin protection, and backend authorization. Rate-limit public signup/acceptance. Pending/rejected applicants receive no session and cannot read workspace data.
- Public submissions use generic acknowledgements and pending-approval guidance without leaking other account states. Tell Administrators that public registration does not verify email ownership; approval does not establish mailbox control. Preserve administrator user creation. Do not introduce a superadministrator role or multi-tenancy.

## Verification and completion

- Test archive/restore across all analytics/reporting paths, timestamp handling, parent and child states, forbidden roles, and unchanged uniqueness before enabling deletion.
- Test dependency deletion order, retained provenance/audits, active-item rejection, typed text, expired/replayed references, stale previews, concurrent edits/imports/syncs, and rollback on every failure.
- Test calendar/timezone boundaries, the explicit September 11–October 10 example, explicit/partial filters, empty data, and distinct provider semantics.
- Test backend preview/PDF parity with unavailable metrics included/excluded and valid zeros preserved.
- Test concurrent pending registrations, preservation of seeded/existing Administrator accounts, pending/rejected access denial, approval/roles, invitation binding/expiry/reuse/revocation, and existing-account protection.
- Run repository-required formatting/lint, typecheck, relevant unit/integration tests, build, and focused browser E2E flows using isolated databases. Inspect package scripts for exact commands: pnpm lint, pnpm typecheck, pnpm test:unit, pnpm test:integration, pnpm build, pnpm test:e2e. Do not reset shared databases or claim checks that did not run.
- Review desktop/narrow layouts, keyboard navigation, focus, dialogs, empty/error states, Back/Forward, and full add data → review → investigate → export flow.
- Stop web dev before building into shared Next.js output; restart and verify script assets afterward. A prior production build overwrote dev assets and caused 404s despite page HTTP 200.
- Use additive migrations preserving existing data. Verify lifecycle endpoints before enabling permanent-delete UI. Never delete real user records to demonstrate functionality.
- Keep work on the feature branch, document evidence and remaining blockers, and push verified work for review without merging unfinished changes to main. Live provider verification remains conditional on authorised credentials/consent.
