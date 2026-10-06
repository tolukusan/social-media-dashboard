# ADR-002 — TypeScript End-to-End Web Stack

**Status:** Accepted  
**Decision:** Use Next.js/React for the web application and NestJS for the API, both in TypeScript.

## Context

The system needs data-entry forms, responsive dashboards, charts, role-aware navigation, a structured API and clear business-service boundaries.

## Decision

Use:

- Node.js 24 LTS
- TypeScript
- Next.js
- React
- NestJS

## Consequences

- one primary language across the project
- type sharing is possible where genuinely useful
- frontend and backend remain separately deployable components
