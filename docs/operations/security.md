# Security Specification

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Security Specification  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 6 — Security, Testing, Reporting & Deployment  
**Depends on:** Steps 1–5 Approved v1.0

## 1. Purpose

This document converts the project's security requirements into concrete implementation controls for the approved Next.js + NestJS + PostgreSQL architecture.

The goal is appropriate MVP security without introducing unnecessary enterprise infrastructure.

---

# 2. Security Principles

## SEC-P01 — Server Is the Authority

The backend is authoritative for:

- authentication
- authorization
- validation
- business rules
- data-access restrictions

Frontend checks exist only for usability.

## SEC-P02 — Least Privilege

Each role receives only approved capabilities from the Step 3 permission matrix.

## SEC-P03 — Deny by Default

Protected backend routes shall reject access unless the authenticated user has the required role/capability.

## SEC-P04 — Preserve History

Deactivation or archival shall not destroy historical attribution.

## SEC-P05 — No Sensitive Data in Logs

Passwords, raw session tokens, password hashes and secrets must never be logged.

---

# 3. Authentication

## 3.1 Login Identifier

Email is the unique login identifier.

Email comparison should be normalised consistently, for example lowercase/trimmed, before uniqueness checks and login lookup.

## 3.2 Password Storage

Use a modern adaptive password hashing function.

**Approved MVP choice: Argon2id.**

Password hashes shall contain their own salt/parameters through the hashing library's encoded output.

Passwords shall never be reversibly encrypted.

## 3.3 Password Policy

Minimum MVP policy:

- minimum length: 10 characters
- allow long passphrases
- do not silently truncate passwords
- maximum accepted length should be bounded reasonably to prevent abuse
- do not require arbitrary composition rules such as mandatory symbols if not needed

Administrator-assisted reset remains available. Users may also change their own password while authenticated: the current password is required, and a successful change revokes all active sessions and outstanding recovery links before the user signs in again.

### 3.5 Self-service email recovery

The approved local completion addition provides self-service recovery for active accounts in all existing roles. A 32-byte random token is sent only to the account email and stored only as a SHA-256 hash. It expires after 30 minutes, is single-use, and is invalidated by replacement, administrator password reset, email change, or deactivation. The reset changes only the password, revokes active sessions, invalidates other recovery tokens, and does not create a session. See [ADR-007](../architecture/adr/ADR-007-password-recovery.md) and the [recovery plan](../plans/password-recovery.md).

Recovery endpoints return the same acknowledgement for active, inactive, and nonexistent accounts. They require an exact configured Origin plus the existing CSRF cookie/header. Reset tokens are placed in the email URL fragment, removed from browser history on page load, and never stored in browser persistence. Production, staging, and unspecified environments must never log the token, reset URL, SMTP credentials, or message payload. The stakeholder authorised local development delivery on 2026-10-08: only explicit `NODE_ENV=development` logs the recipient, recovery link, and expiry instead of sending SMTP mail. Use local development accounts; these ephemeral links are not retained as verification evidence. Passwords, session tokens, and SMTP credentials remain excluded from all logs.

## 3.4 Login Failure

For invalid credentials, return a generic message such as:

`Invalid email or password`

Do not reveal whether the email exists.

## 3.5 Login Rate Limiting

The API shall rate-limit repeated login attempts.

Initial policy may be implementation-configurable.

A suitable starting point is a small burst allowance followed by temporary throttling.

Exact thresholds may be tuned during testing.

---

# 4. Session Security

## 4.1 Session Token

- generate using a cryptographically secure random source
- token must have sufficient entropy
- store only a cryptographic hash of the token in PostgreSQL
- send the raw token only in the user's secure cookie

## 4.2 Session Cookie

Production settings:

- `HttpOnly = true`
- `Secure = true`
- `SameSite = Lax` when frontend/API deployment topology allows it
- explicit `Path`
- explicit expiry/max-age

If deployment topology requires cross-site cookies, the security implications must be reviewed rather than changing SameSite casually.

## 4.3 Session Lifetime

Approved MVP defaults:

- idle timeout: 8 hours
- absolute lifetime: 7 days
- logout revokes the current session
- user deactivation revokes all active sessions for that user
- administrator password reset revokes all existing sessions for that user

These values shall be environment-configurable.

## 4.4 Session Cleanup

Expired/revoked sessions should be periodically cleaned from the database.

The bounded `session:cleanup` maintenance command removes sessions only after they have been expired or revoked for more than 30 days. The recovery-token cleanup command uses the same retention principle. No external queue is required.

---

# 5. CSRF Protection

Because authentication uses cookies, state-changing requests must be protected against cross-site request forgery.

Approved strategy:

- strict Origin validation against the configured application origin for every unsafe method
- SameSite cookie protection
- CSRF token protection for unsafe cookie-authenticated methods

Unsafe methods include:

- POST
- PUT
- PATCH
- DELETE

Do not rely only on hidden UI controls.

---

# 6. CORS

CORS shall be explicitly configured.

Production should allow only approved frontend origin(s).

Do not use wildcard origins with credentialed requests.

---

# 7. Authorization

Authorization shall follow the Step 3 permission matrix.

Backend authorization guards/policies shall distinguish:

- unauthenticated
- authenticated but forbidden

Management role remains read-only.

Marketing Officer cannot administer users, roles, channels or platforms.

Administrator-only archive/deactivation operations must be enforced server-side.

---

# 8. Input Validation

All API inputs shall be validated.

Validation shall cover:

- required fields
- types
- string lengths
- allowed enum values
- date formats
- numeric ranges
- IDs
- arrays
- nested payloads

Unknown/unexpected fields should be rejected or stripped consistently.

Business-rule validation belongs in services, not only DTO decorators.

---

# 9. Database Security and Integrity

## 9.1 Database User

Production application shall connect using a dedicated database account.

Do not run the application using a PostgreSQL superuser.

## 9.2 Constraints

Use database-level constraints for:

- primary keys
- foreign keys
- unique constraints
- non-null fields
- appropriate check constraints

## 9.3 Transactions

Use transactions for multi-record operations that must succeed or fail together.

Examples:

- create Campaign + CampaignChannels + CampaignPlatforms
- create PerformanceRecord + metric values
- archive record plus related state changes where needed

## 9.4 Migration Safety

Schema changes require migration files.

Never use ad-hoc production schema mutation as the normal deployment workflow.

---

# 10. Data Exposure

API responses shall return only fields required by the client.

Never return:

- passwordHash
- session token hash
- secrets
- internal error stack
- raw database exception details

---

# 11. Security Headers

Production web responses should enable suitable security headers, including where applicable:

- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- frame-ancestor protection through CSP
- Permissions-Policy where useful

HSTS should be enabled when production is served exclusively over HTTPS.

---

# 12. File / Report Security

Generated reports may contain internal performance information.

Rules:

- report generation requires authentication
- report scope follows the user's permissions
- generated PDF files should not be published to anonymous permanent URLs
- temporary generated files must be cleaned up if filesystem rendering is used
- report filenames must be sanitised
- user input must never become an arbitrary filesystem path

---

# 13. Logging

Log:

- application startup/shutdown
- request failures
- authentication success/failure at a safe level
- authorization denials where useful
- administrative actions where approved
- report-generation failures
- unexpected server errors

Do not log:

- plaintext passwords
- raw session tokens
- password hashes
- database credentials
- environment secrets
- unnecessarily complete personal information

---

# 14. Audit Logging

Audit logging is approved for the following high-value events:

- user creation
- user role change
- user activation/deactivation
- administrator password reset
- channel/platform create/update/deactivate
- campaign archive
- performance-record archive
- KPI-target create/update/end-date
- self-service password change and self-service recovery completion

Logical AuditLog fields:

```text
id
actorUserId
action
entityType
entityId
metadata
createdAt
```

`metadata` must not contain secrets.

A full event-sourcing system is not required.

---

# 15. Dependency Security

Implementation shall:

- use lockfiles
- avoid unnecessary packages
- review packages before adding them
- run dependency vulnerability checks as part of release verification
- avoid automatic major upgrades during the project

---

# 16. Secret Management

Never commit:

- `.env`
- database passwords
- session secrets
- external API secrets

Provide `.env.example` using placeholder values.

Production secrets belong in the deployment platform/environment configuration.

---

# 17. Security Test Requirements

Minimum security verification:

- protected route rejects unauthenticated request
- role-restricted route rejects wrong role
- Management cannot write operational data
- deactivated user cannot log in
- deactivation revokes active sessions
- password reset revokes old sessions
- invalid session rejected
- expired session rejected
- login response does not reveal account existence
- CORS rejects unapproved origins
- unsafe cookie-authenticated mutations have CSRF protection
- password hash never appears in API output
- archived records excluded from normal analytics
- invalid foreign-key relationships rejected
- platform/channel mismatch rejected

---

# 18. Approved Step 6 Security Decisions

## SQ-001 — CSP Strictness

**Decision:** Start with a practical Content Security Policy compatible with the approved Next.js/Recharts frontend, then tighten it after required script/style behaviour is verified.

## SQ-002 — Failed-Login Audit Events

**Decision:** Record failed-login security events without passwords or excessive personal data. Store only the minimum context required for security review.

## SQ-003 — Administrative Session Revocation UI

**Decision:** A dedicated session-management UI is not required for the MVP. User deactivation and administrator-assisted password reset automatically revoke that user's sessions.

---

# 19. Step 6 Security Approval Status

**Approved v1.0.**

The implementation shall follow the authentication, session, CSRF/CORS, authorization, database, logging, audit and report-security controls defined in this document.

## Current completion approval provenance

The own-password current-password check and revocation of all sessions/recovery links were explicitly approved by the stakeholder on 2026-10-07; see [CD-001](../governance/completion-decisions-2026-10-07.md). This is the current decision date, not evidence that the preceding AI implementation had historical approval. Other approved controls remain unchanged.
