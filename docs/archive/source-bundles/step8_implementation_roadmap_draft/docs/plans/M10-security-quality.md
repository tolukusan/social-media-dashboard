# M10 — Security & Quality Hardening

**Status:** Proposed  
**Phase:** Step 8 Implementation Plan

## Objective

Apply the approved security and quality baseline across the integrated application.

## Scope

- CSRF protection
- CORS allowlist
- security headers
- session cleanup
- input validation review
- error-shape consistency
- sensitive-field review
- accessibility pass
- responsive pass
- log hygiene

## Non-Goals

- enterprise SIEM
- WAF product integration
- SSO

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

- [ ] cookie-authenticated unsafe mutations protected
- [ ] credentialed wildcard CORS absent
- [ ] password/session secrets absent from logs/API
- [ ] forbidden/unauthenticated responses correct
- [ ] basic accessibility checks pass
- [ ] security tests pass

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
