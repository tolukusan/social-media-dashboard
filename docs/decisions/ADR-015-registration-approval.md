# ADR-015: Registration approval and invitations

Status: approved stakeholder correction, 2026-10-18.

Retain one organization per deployment and the seeded Administrator setup. Existing users, role IDs, sessions, and historical records are preserved. There is no first-user registration/bootstrap, automatic public Administrator assignment, organization table, platform administrator, billing, or subscription model.

Public signup creates a separate pending RegistrationRequest containing an Argon2id password hash. It creates neither a User nor a session. An active Administrator explicitly approves with one existing active role, or rejects. Resolution clears the request's password hash; approval creates the user with the applicant's credentials. Existing accounts are never replaced, reactivated, or assigned a new password by signup. Repeated submissions return the same acknowledgement and do not replace credentials.

Administrators can issue email/role-bound invitations, manually deliver the one-time copyable link, and revoke unused invitations. Invitations expire after seven days and store only a SHA-256 token hash. Tokens live in the URL fragment, are removed from history on load, remain only in component memory, and are protected by a no-referrer page policy. Invitation lists and audits never return tokens. Acceptance requires the invited email, an active inviting Administrator, an active existing role, and no existing account or unresolved pending request. Acceptance is atomic, single-use, creates a user, and asks the recipient to sign in through the existing session flow.

Email-scoped transaction advisory locks serialize public requests, reviews, and invitation acceptance. Database email/token uniqueness is the final race safeguard. Public requests require exact Origin and CSRF protections, bounded input, and per-process IP/email rate limits (10 submissions per 15 minutes, bounded map). Deployments using multiple API processes should apply equivalent shared ingress rate limiting; database uniqueness and transactional acceptance still apply across processes. No mail service is needed or invoked.
