# ADR-003 — PostgreSQL with Prisma ORM

**Status:** Accepted  
**Decision:** PostgreSQL is the source database. Prisma ORM 7 is the application ORM.

## Context

The domain is relational and requires foreign keys, many-to-many joins, uniqueness rules, transactions and analytical aggregation.

## Decision

Use PostgreSQL with migration-controlled schema changes.

Use Prisma ORM 7 rather than adopting an unstable/new release-candidate major during initial implementation.

## Consequences

- strong relational integrity
- typed application access
- explicit migrations
- raw SQL remains available when analytics queries require it
