# SKILL.md — Database Change

## Purpose

Use for Prisma/PostgreSQL schema changes, migrations, constraints or persistence-model changes.

## Procedure

1. Read `AGENTS.md`.
2. Read `docs/domain-model.md`.
3. Read `docs/erd.md`.
4. Read `design-amendments-v1.1.md`.
5. Read task-specific requirements.
6. Inspect existing Prisma schema and migration history.
7. Determine whether change is additive, modifying or destructive.
8. Check historical-data impact.
9. Define database constraints.
10. Define service-level validation that cannot be expressed safely in the database.
11. Create migration.
12. Apply migration to a clean/test database.
13. Add integration tests for constraints and relationships.
14. Run typecheck/tests/build.
15. Report migration and rollback/data risk.

## Mandatory Questions

- Does this break existing rows?
- Does this invalidate historical references?
- Does this alter an approved cardinality?
- Does this add a future-scope concept prematurely?
- Can the database enforce this rule directly?
- Does this require a transaction?

## Stop Conditions

Stop if:

- destructive migration lacks approved migration plan
- required cardinality is undefined
- change contradicts approved domain model
- task tries to add live integration credentials directly to Platform
