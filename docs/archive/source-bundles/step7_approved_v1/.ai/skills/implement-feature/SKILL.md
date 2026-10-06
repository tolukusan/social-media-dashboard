# SKILL.md — Implement Feature

## Purpose

Use for normal bounded feature work after requirements and architecture already exist.

## Inputs

- approved task/milestone plan
- relevant requirements
- relevant workflow
- current codebase

## Procedure

1. Read `AGENTS.md`.
2. Read the current task plan.
3. Load only relevant context using `.ai/CONTEXT_MAP.md`.
4. Inspect current implementation and tests.
5. Confirm the task is within approved scope.
6. Identify smallest coherent implementation slice.
7. Implement backend rules first when the backend is authoritative.
8. Implement frontend behaviour against the API contract.
9. Add/update tests.
10. Run risk-appropriate verification.
11. Update documentation only if approved behaviour changed.
12. Produce completion report.

## Must Not

- invent missing business rules
- broaden the milestone
- replace architecture
- opportunistically rewrite unrelated code
- report unrun tests as passing

## Done When

- acceptance criteria pass
- relevant tests pass
- typecheck/build pass
- no hidden blocker remains
