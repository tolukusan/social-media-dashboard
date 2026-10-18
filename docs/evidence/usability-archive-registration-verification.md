# Usability, archive lifecycle, and registration verification

Date: 2026-10-18. Branch: `feat/usability-archive-registration`. Handoff: `7e865102f59e1c2e2cfc735c308b9d7e7cd0e7a8`; main base: `aabad94c3732bc11ba95a91ab90fbcb799705d2c`.

## Delivered scope

The [approved plan](../plans/completion/usability-archive-registration.md) was corrected before registration implementation: retain the seeded Administrator, one organization, fixed roles, and existing accounts. Public requests require explicit Administrator approval. There is no first-user bootstrap or automatic public Administrator assignment.

- Shared active-record/unarchived-parent eligibility covers campaign dashboards, trends, comparisons, report preview/PDF, record lists, and default-date discovery. Restore preserves individual child state and daily uniqueness. Archive actions recheck state under the transaction lock.
- Administrator-only Archive lists, restore, authoritative dependency previews, and permanent deletion use typed identity, five-minute actor-bound single-use references, full dependency fingerprints, transaction rollback, and a shared lifecycle lock. Mapping blockers require explicit unmapping; running leases prevent unsafe removal. Import provenance, source rows, duplicate checks, and audits survive deletion. Tombstones and locked ingestion prevent silent automatic recreation.
- Six navigation sections, Overview landing, distinct campaign/account guidance, latest-record calendar defaults, partial-date preservation, available channel metrics, trend selector, simpler provider cards, comparison guidance, direct report filters, backend unavailable-metric filtering, and responsive Archive dialogs are implemented.
- Pending access applications, Administrator approval/rejection and explicit existing role assignment, and manually delivered seven-day email/role-bound invitations are implemented. Invitation hashes, single-use claims, revocation, existing-account protection, CSRF/origin guards, and public request limits are enforced by the API. Public applicants receive no session before approval.

Policies: [ADR-014](../decisions/ADR-014-archive-lifecycle.md), [ADR-015](../decisions/ADR-015-registration-approval.md). Operations: [deployment instructions](../guides/deployment-runbook.md), [user guide](../guides/user-guide.md).

## Migration safety

Three additive migrations were deployed through the isolated PostgreSQL 18 test runner (14 total committed migrations). No database reset was performed.

1. `20261018070000_archive_timestamps`: backfill only audit-supported archive dates; unknown dates remain null.
2. `20261018071000_archive_deletion`: add confirmation hashes and durable deleted daily-key tombstones; no deployment-time deletion.
3. `20261018072000_registration_approval`: add request status, registration requests, invitations, and constraints; insert missing fixed role codes only, preserving existing role/user identities and seeded Administrators.

Confirmation/tombstone identities deliberately survive deleted entities. Existing restrictive foreign keys remain. Normal legacy DELETE endpoints continue to archive. Production migrations must use the normal backed-up deployment procedure, not demo seeding.

## Verification

Environment: Node 24.19.0, Corepack pnpm 11.8.0, PostgreSQL 18 isolated test database, system Chromium. Tests use generated isolated identities and synthetic fixtures only.

- `corepack pnpm install --frozen-lockfile`: passed; lockfile unchanged.
- `corepack pnpm lint`: passed.
- `corepack pnpm typecheck`: passed.
- `corepack pnpm build`: passed API and optimized Next.js builds, including public access routes.
- `corepack pnpm test:unit`: 107 passed across 25 files.
- `corepack pnpm test:integration`: 76 passed across 10 files after final lifecycle changes.
- `corepack pnpm format:docs`, changed-source lint, `corepack pnpm exec prettier --check e2e`, and `git diff --check`: passed.
- Complete Playwright suite: all 23 journeys passed with system Chromium (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium corepack pnpm exec tsx scripts/run-e2e.ts` from `apps/api`). Includes all existing OAuth, import, comparison, synchronization, PDF, session, responsive, keyboard, and role journeys, plus application approval, invitation acceptance, defaults/report scope, and Archive restore/delete at 390px.

New integration coverage exercises parent/child archive visibility and restore, unchanged date uniqueness, active-item rejection, wrong typed text, stale/expired/replayed confirmations, mapping blockers, running sync protection, concurrent confirmation claims, dependency deletion order, retained provenance/audits, actual stale import confirmation, a captured stale provider response after unmapping, and injected database audit failure with full rollback. Access tests cover concurrent duplicate applications, no public bootstrap/session, pending login denial, origin/CSRF rejection, forbidden roles, explicit approval/rejection, invitation email binding, existing-account takeover prevention, concurrent/replayed/expired/revoked invitations, and rate limiting.

The first browser pass found callback navigation and narrow trend-selector regressions, plus selectors/expectations needing adaptation to report filtering and the new access UI. Those were corrected before the final complete rerun. Existing OAuth callbacks, provider comparison, synchronization states, CSV import and PDF journeys remain in the complete suite.

## Boundaries and remaining acceptance

No real credentials were read or added, no environment values were copied into Git, no production demo analytics were introduced, no external email was sent, and no shared database was reset. OAuth provider internals, scopes, token storage, and AAN-01 provider retention rules are unchanged. Campaign integration changes coordinate lifecycle writes and explicit mapping removal.

Live provider consent and comparison against live provider reports remain conditional on an authorized account owner and configured provider credentials; mocked browser/integration coverage does not establish that external acceptance. No new implementation blocker is known. Public limits are per API process; shared ingress limits are required before scaling to multiple processes. Lifecycle writes serialize per deployment for correctness. Main has not been merged or deployed.
