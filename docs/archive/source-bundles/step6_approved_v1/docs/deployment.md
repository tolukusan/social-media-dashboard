# Deployment and Operations Plan

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Deployment and Operations Plan  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 6

## 1. Goal

The deployment model shall be simple enough to demonstrate, maintain and document while supporting the approved web/API/database architecture.

---

# 2. Deployment Units

The MVP has three primary runtime units:

```text
Web
API
PostgreSQL
```

The web and API may be deployed on the same host or separately.

The database should not be exposed publicly unless the hosting model explicitly requires secured remote access.

---

# 3. Preferred Demonstration Deployment

Preferred baseline:

- Linux VPS or managed application host
- HTTPS reverse proxy / platform TLS
- web application
- API application
- managed or host-local PostgreSQL
- environment-based secrets

A local-only demonstration remains possible if public hosting becomes unavailable, but deployment instructions must be reproducible.

---

# 4. Containers

Docker may be used for:

- consistent local development
- test PostgreSQL
- deployment packaging

Docker is useful but not a project goal.

Kubernetes is explicitly out of scope.

---

# 5. Environment Separation

At minimum:

- local development
- test
- production/demo

Do not reuse the production database for automated tests.

---

# 6. Required Environment Configuration

Expected variables include:

```text
NODE_ENV
WEB_ORIGIN
API_ORIGIN
DATABASE_URL
REPORTING_CURRENCY
REPORTING_TIMEZONE
SESSION_IDLE_HOURS
SESSION_ABSOLUTE_DAYS
SESSION_TOKEN_PEPPER_OR_SECRET_IF_USED
PORT
```

Exact names may be refined.

`.env.example` shall document required values without secrets.

---

# 7. HTTPS

Production/demo deployment shall use HTTPS.

Session cookies must not be downgraded to insecure mode merely to simplify deployment.

---

# 8. Database Migration Deployment

Deployment sequence:

```text
backup/check database
    ↓
deploy new application version
    ↓
run approved Prisma migration
    ↓
run startup/health checks
    ↓
make new version active
```

For destructive migrations:

- explicit review required
- backup required
- rollback/recovery plan required

---

# 9. Backups

Production/demo database should have:

- scheduled backup
- documented restore procedure

For the academic MVP, one daily database backup is a reasonable baseline.

Backups must not be committed to Git.

---

# 10. Health Checks

API shall expose a health endpoint.

At minimum verify:

- application process is running
- database connectivity

Do not expose secrets or detailed infrastructure internals in public health responses.

---

# 11. Logging

Production logs should capture:

- startup
- application errors
- failed background maintenance
- report failures
- database connectivity failures
- security-relevant administrative events where configured

Logs shall not contain secrets.

---

# 12. Maintenance Tasks

Simple scheduled/administrative tasks may include:

- expired session cleanup
- backup rotation depending on host
- temporary report-file cleanup if needed

Do not introduce Redis/queue infrastructure only for these tasks.

---

# 13. Deployment Documentation

Final project documentation shall include:

- prerequisites
- environment variables
- database creation
- migration commands
- seed commands
- build commands
- startup commands
- HTTPS/reverse-proxy notes where applicable
- backup/restore procedure
- demo-user creation process
- troubleshooting notes

---

# 14. Demonstration Data

Provide a deterministic demo seed containing:

- Administrator
- Marketing Officer
- Management user
- channels/platforms
- example campaigns
- example performance data
- example KPI targets

Demo passwords should be documented only for the demo environment and must not be reused in a real deployment.

---

# 15. Rollback Principle

Application deployment should keep rollback practical.

If a release fails before an irreversible migration:

- restore previous app version

If data migration is destructive or incompatible:

- follow the migration-specific backup/restore plan

Do not claim automated zero-downtime rollback unless it has actually been implemented and tested.

---

# 16. Open Deployment Questions

## DQ-001 — Exact Hosting Provider

Deferred until implementation/deployment stage.

## DQ-002 — Same-Host vs Split Web/API

**Proposed:** keep flexible. Same host is acceptable for MVP.

## DQ-003 — Managed vs Host-Local PostgreSQL

**Proposed:** either is acceptable if backups and access controls are documented.

## DQ-004 — Docker in Production

**Proposed:** optional. Use if it materially simplifies deployment, not as a requirement.


# 17. Step 6 Deployment Approval Status

**Approved v1.0.**

The exact hosting provider remains intentionally deferred. The approved deployment shape is Web + API + PostgreSQL with HTTPS, environment-managed secrets, migrations, health checks, backups and reproducible deployment documentation.
