# ADR-005 — REST JSON API

**Status:** Accepted  
**Decision:** Use a versioned REST JSON API under `/api/v1`.

## Context

The application is CRUD- and analytics-oriented, with well-defined resources and no requirement for client-defined graph queries.

## Decision

Use REST rather than GraphQL.

## Consequences

- straightforward routes
- easy OpenAPI documentation
- easy testing
- predictable academic demonstration
