# M02 — Authentication & User Management

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Deliver secure login/session handling, RBAC foundation and Administrator user management.

## Scope

- Argon2id password hashing
- login/logout/me endpoints
- opaque DB-backed sessions
- secure cookie handling
- session expiry/revocation
- Administrator user CRUD within approved scope
- role assignment
- user activation/deactivation
- administrator-assisted password reset
- backend RBAC guards
- basic login/user-management UI

## Non-Goals

- self-service email password reset
- dynamic permission builder
- SSO
- OAuth/social login

## Required Process

1. INVESTIGATE current repository state.
2. Compare current state with approved documentation.
3. Produce a bounded implementation plan.
4. Implement only this milestone.
5. Add/update relevant tests.
6. Run required verification.
7. Produce completion report.
8. Submit for review before beginning the next milestone.

## Acceptance Criteria

- [ ] active user can log in
- [ ] invalid credentials do not reveal account existence
- [ ] deactivated user cannot log in
- [ ] logout revokes session
- [ ] deactivation revokes sessions
- [ ] password reset revokes sessions
- [ ] Marketing Officer/Management cannot manage users
- [ ] password/session secrets never appear in API output

## Verification

At minimum:

```text
lint
typecheck
relevant unit tests
relevant integration tests
build
relevant E2E smoke tests when applicable
```

Do not mark this milestone complete unless the acceptance criteria and relevant verification checks pass.
