# SKILL.md — Security-Sensitive Change

## Purpose

Use for authentication, authorization, passwords, sessions, CORS, CSRF, audit, sensitive logs and protected report behaviour.

## Required Context

- `docs/operations/security.md`
- `docs/product/permissions-matrix.md`
- `docs/architecture/architecture.md`

## Procedure

1. Identify assets and trust boundary affected.
2. Identify roles/users affected.
3. Identify positive allowed case.
4. Identify negative/forbidden case.
5. Check whether session revocation is affected.
6. Check cookie/CSRF/CORS implications.
7. Check logging and data exposure.
8. Implement backend enforcement first.
9. Add security-focused tests.
10. Verify no secret/sensitive field is returned or logged.
11. Run relevant integration/E2E tests.

## Stop Conditions

Stop if:

- change weakens approved password/session controls
- authorization rule is not defined
- wildcard credentialed CORS is proposed
- raw session tokens/passwords would be logged/stored insecurely
- frontend-only authorization is proposed
