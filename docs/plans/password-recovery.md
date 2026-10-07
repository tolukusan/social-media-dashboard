# Password recovery implementation plan

Date: 2026-10-07. Status: implemented locally; full verification and external SMTP delivery remain.

## Request and scope

The stakeholder first requested a plan for recovery after forgetting a password. A subsequent implementation task added the self-service email recovery flow to the existing account workflows. This document now serves as the implementation and verification handoff. External email sending still requires authorised SMTP configuration.

The original [F03 completion task](completion/product-completion.md#f03---finish-account-and-user-management-workflows) excluded email recovery to bound MVP scope. The stakeholder has requested a plan for that scope addition. Preserve that historical requirement and reference this plan when a subsequent implementation task authorises the addition. Recovery does not require public signup, a new authentication platform, or changes to user roles.

Use the existing Next.js frontend, NestJS Auth/Users modules, REST API, PostgreSQL application schema, Prisma, and Argon2id. Follow [security rules](../operations/security.md), [permissions](../product/permissions-matrix.md), [architecture](../architecture/architecture.md), [domain model](../architecture/domain-model.md), [ERD](../architecture/erd.md), [design amendments](../governance/design-amendments-v1.1.md), and the repository's [security-change](../../.ai/skills/security-change/SKILL.md) and [database-change](../../.ai/skills/database-change/SKILL.md) instructions.

## User journey

1. A user selects **Forgot password?** on the login screen.
2. `/forgot-password` asks for their account email and submits a recovery request.
3. The screen always says: **If an active account uses this email, we will send a password reset link.** It offers a return to sign-in and explains that delivery may take a moment.
4. For an eligible account, the API emails a link to the account's current email address. The link opens `/reset-password#token=...`; using a fragment keeps the token out of the initial HTTP URL and normal access logs.
5. The reset screen captures the token in memory, removes the fragment using `history.replaceState`, and asks for a new password and confirmation. Display the existing minimum of 10 characters and allow passphrases.
6. On success, the screen confirms the change and links to sign-in. The user signs in with the new password; recovery does not automatically create a session.
7. A missing, expired, already-used, revoked, or invalid link shows one clear message and a link to request another. Never disclose the associated account.

Provide accessible labels, inline validation, pending states, safe retry messages, and keyboard navigation. Avoid recovery tokens in localStorage, sessionStorage, query caches, analytics, screenshots, or error reports. A refresh after the fragment has been removed requires reopening the email link; explain this if the reset screen no longer has a token.

## Proposed implementation defaults

- Allow recovery for active accounts in all three existing roles. Possession of the reset token authorises only changing that account's password; it cannot change email, role, activation, or profile fields.
- Generate 32 cryptographically random bytes, encode as base64url, and store only a SHA-256 token hash. Tokens expire after 30 minutes and are single use.
- A new eligible request invalidates older unused recovery links for the account. Rate-limit requests before issuing tokens; limit retries so the form cannot flood email delivery.
- Use the same response status, body, and delivery-independent response path for existing, nonexistent, and inactive accounts. Mail failures must not create an account-existence signal. Review response timing during verification.
- Start with configurable limits of 3 requests per normalised email per 15 minutes and 20 requests per source IP per 15 minutes; limit reset attempts to 20 per source IP per 15 minutes. Apply limits consistently whether an account exists. Bound limiter memory, expire entries, and use hashed email keys. Trust proxy headers only under explicit deployment configuration.
- Hash the replacement password with Argon2id and revoke every active session and outstanding recovery token for the user in the same transaction. Clear the browser's session cookie after success, then discard cached session/workspace data.
- Administrator reset, account deactivation, and email changes invalidate outstanding recovery tokens. Reactivation must not make a previously invalidated link usable again. Keep the existing Administrator permission boundary.
- Require the configured application Origin and the existing CSRF cookie/header on recovery POST requests. Explicitly define and test missing-Origin rejection for these browser endpoints. Preserve the CORS allowlist and cookie protections.
- Never log passwords, raw reset tokens, reset URLs, SMTP credentials, or SMTP message payloads. Audit successful resets with safe event metadata; delivery failures use a fixed error code without provider exception text.

These are proposed implementation choices for this feature. The existing own-password-change task remains separate; recovery works when the old password is unknown.

## API and persistence

| Endpoint                            | Input                               | Result                                                                            |
| ----------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `POST /api/v1/auth/forgot-password` | Valid email, normalised server-side | `202` with the generic acknowledgement; identity-independent `429` when throttled |
| `POST /api/v1/auth/reset-password`  | Token and new password              | `200` with success; one generic `400` for unusable links; `429` when throttled    |

Validate DTOs, reject extra fields, bound email/token/password input sizes, and preserve the existing password minimum without trimming or silently truncating passwords. Confirmation is a frontend usability field. Return neither user data nor token data from these endpoints, and set responses to `Cache-Control: no-store`.

Use explicit metadata or exact route matching for the two public handlers in `SessionGuard`; public authentication does not bypass CSRF or Origin enforcement. `RolesGuard` continues protecting Administrator actions.

Add a `PasswordRecoveryToken` model within `social_media_dashboard` with `id`, `userId`, unique `tokenHash`, `emailAtIssue`, `createdAt`, `expiresAt`, `usedAt`, and `revokedAt`. The User-to-token relationship is one-to-many with a foreign key and an index supporting user invalidation and expiry cleanup. Add a check that expiry follows creation. The email snapshot allows rejecting a token issued before an email change.

Migration requirements: additive table and relation only; existing users, sessions, analytical records, and historical references remain intact. Apply and test first against the genuinely isolated database. Generate Prisma after the schema change. Production/local application migration must follow the repository's non-destructive migration process; never reset a database or rerun seed as account recovery. Rollback can disable the feature while leaving the additive table in place.

Serialize issuance, redemption, and relevant Administrator credential/account mutations using the same per-user transaction lock. After acquiring the lock, re-read eligibility and token state. Claim the token conditionally, update the password, revoke sessions, and invalidate other tokens atomically. Compute the new Argon2id hash outside the lock, then revalidate before writing. Tests must show that two concurrent redemptions cannot both succeed and that Administrator reset/deactivation cannot leave a stale recovery link usable.

Expired/used/revoked tokens remain unusable even before cleanup. Define a bounded cleanup command and document an operational retention interval before enabling scheduled cleanup; this is authentication housekeeping, not deletion of analytical records.

## Email delivery and local development

Use an SMTP adapter behind an injectable mail service in the Auth module. Select a maintained SMTP library, install it project-locally with pnpm, and keep the single lockfile. Record the delivery approach and token lifecycle in an ADR during implementation.

Document placeholder variables in `.env.example`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Construct the link from validated `APP_ORIGIN`, never a request Host header or user-supplied redirect. Require HTTPS outside local development. Use TLS for authenticated external delivery and validate certificates.

Keep network delivery outside the public response path with bounded process-local work, timeouts, and handled failures; no message broker or Redis is needed. Persist token state before sending. If delivery fails, revoke only that request's token, without invalidating a newer one. A process restart may lose pending mail; the user can request again after throttling permits. Document this delivery limitation. Do not store raw tokens in a database outbox or add unreviewed retry infrastructure.

Use an injected in-memory capture adapter for automated tests and a loopback-only SMTP capture server for local manual verification. Test-only capture must not be reachable through a production API or expose links in logs. Real SMTP credentials belong in an ignored local environment file; the sender address and provider must be configured before validating external delivery. Code and isolated tests can be completed before external credentials are available, but real inbox delivery must be reported separately.

Recovery can only help an existing account with a reachable email address. If the forgotten login was never created, or the only Administrator cannot receive email, use a separately authorised local account/bootstrap procedure. Recovery must not create or elevate accounts.

## Bounded execution sequence

| Task | Work and expected files                                                                                                                                                                 | Exit evidence                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| PR01 | Reinspect Auth/Users, schema and migration history; record this scope addition and defaults in an ADR, security specification, domain/ERD extension, and completion references          | Requirement and migration compatibility review; no historical requirements silently rewritten |
| PR02 | Add the token model, additive migration, DTOs, recovery service, mail-service interface, and atomic invalidation in `apps/api/src/auth/`, `apps/api/src/users/`, and `apps/api/prisma/` | Isolated database constraints, expiry, single-use and concurrency cases pass                  |
| PR03 | Add SMTP transport/configuration, exact public-handler authentication exemptions, Origin/CSRF enforcement, throttling, safe audit events, and delivery-failure handling                 | Real HTTP permission/CSRF/Origin tests and SMTP capture verification pass                     |
| PR04 | Add `apps/web/app/forgot-password/page.tsx`, `apps/web/app/reset-password/page.tsx`, recovery forms under `features/auth/`, and a login link; reuse `lib/api-client.ts`                 | Browser recovery journey, expired-link handling and accessible interaction pass               |
| PR05 | Run required checks, verify configured mail delivery where available, and update guides, TODO, evidence and completion ledger                                                           | Accurate distinction between local verification, actual email delivery, and deployment        |

Implement each task as a coherent change. Reinspect local pnpm installation capability rather than assuming the historical NVM4306 blocker still applies; successful `pnpm dev` alone does not establish that new packages can be installed.

## Verification and acceptance

- Unit cases: email normalisation, token entropy/format/hash, expiry boundary, generic acknowledgements, limiter limits/expiry/memory bounds, trusted link origin, and sanitised failures.
- Isolated HTTP/PostgreSQL cases: active users across roles; missing/inactive users; invalid DTOs; allowed/disallowed/missing Origin; missing/mismatched CSRF; token hash uniqueness and foreign key; expired/used/revoked/malformed tokens; request replacement; simultaneous redemption; Administrator reset, email change, deactivation/reactivation races; password and session revocation committed atomically; rollback on failure.
- Verify old password rejection, new password login, unchanged role/email, denial of old sessions, and no password/token/hash in API responses or logs. Confirm reset endpoints remain usable without an authenticated session while protected routes remain protected.
- Browser case: sign out, follow Forgot password, request a link, obtain it from the isolated capture adapter, set/confirm a password, sign in again, and reject reuse. Cover mismatch validation, expiry, retry, keyboard navigation, focus/error announcements, mobile layout, and removal of token fragments.
- SMTP cases: captured email has the configured sender, correct trusted link and expiry text; TLS/config failure is safe; delayed delivery and old-link invalidation behave correctly. Inspect generated email without recording credentials or tokens in evidence.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`, `pnpm test:e2e`, and documentation formatting checks using repository-equivalent commands and the isolated test target. Keep test recovery mail and users separate from development data.

Completion means the implemented journey passes local verification, migration integrity is demonstrated, and configuration/recovery limitations are documented. Claim actual inbox delivery only after verifying an authorised configured provider. Claim no external deployment without an authorised environment.

## Current deliverable

The implementation is present in the repository, including the additive recovery-token migration, Auth/Users services, SMTP adapter, recovery UI, and HTTP/PostgreSQL integration coverage. The continuation work adds trusted-Origin enforcement for login, retry-safe reset UI behaviour, and app-local environment templates. Full local verification has not been rerun in this GitHub-only continuation, and actual inbox delivery remains unverified until an authorised SMTP provider is configured.
