# ADR-001 — Use a Modular Monolith

**Status:** Accepted  
**Decision:** Build one NestJS backend organised into explicit feature modules.

## Context

The MVP contains several related domains but does not require independent scaling or independent deployment.

## Decision

Use a modular monolith.

## Consequences

Positive:

- simpler deployment
- simpler transactions
- simpler debugging
- clearer academic demonstration
- module boundaries remain explicit

Negative:

- modules share one deployment lifecycle
- extraction into services later would require deliberate work

## Rejected

- microservices
- serverless function-per-feature architecture
