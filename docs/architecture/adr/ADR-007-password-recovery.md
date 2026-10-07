# ADR-007: Email password recovery

- **Status:** Accepted for local MVP implementation
- **Date:** 2026-10-07

## Context

The original F03 scope used administrator-assisted password resets. The approved completion task now adds a self-service email flow for active users while retaining the existing login, role, session, and account-management architecture.

## Decision

- Use 32 random bytes encoded as base64url; persist only a SHA-256 hash, the issue-time email snapshot, and lifecycle timestamps in PostgreSQL.
- Tokens expire after 30 minutes, are single-use, and a replacement request revokes older unused links.
- Use an injected Nodemailer SMTP adapter with bounded process-local delivery work. Email links use validated `APP_ORIGIN` and place the token in a URL fragment.
- Require the configured Origin and the existing CSRF cookie/header for both recovery POST endpoints. Keep both endpoints unauthenticated and identity-neutral.
- Serialize token issue/redemption and administrator password, email, and activation mutations using a transaction-scoped PostgreSQL advisory lock per user.
- A successful recovery changes only the password, revokes active sessions and outstanding links in one transaction, and records a safe audit event. It does not create a session.
- Keep SMTP credentials in ignored local environment configuration. No mail queue, broker, or external deployment is introduced.

## Consequences

Recovery is available only when an active account has a reachable email and SMTP is configured. Pending mail is process-local and can be lost on restart; users may request another link after throttling allows it. Expired tokens are unusable immediately and may be removed by the bounded cleanup command after 30 days beyond expiry. External inbox delivery remains unverified until an authorised provider is configured.

The token table and foreign key are additive. Rollback disables the endpoints while retaining the table; no user, session, analytical, or historical data is removed.
