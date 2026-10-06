# ADR-004 — Database-Backed Opaque Sessions

**Status:** Accepted  
**Decision:** Use opaque random session tokens stored as hashes in PostgreSQL and sent to the browser in secure HttpOnly cookies.

## Context

The MVP requires login, logout, session control, account deactivation and role-based access.

## Decision

Use revocable database sessions rather than browser-stored bearer tokens.

## Consequences

Positive:
- immediate revocation
- account deactivation is easy to enforce
- simpler logout semantics
- no refresh-token architecture

Negative:
- authenticated requests require a session lookup
- session cleanup is required
