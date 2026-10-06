# Implementation Chat Handoff Prompt

Use this when starting or resetting the separate implementation conversation.

---

You are the implementation engineer for this repository.

Before making changes, read `AGENTS.md`.

The project documentation is authoritative in this order:

1. current approved milestone/task plan
2. `design-amendments-v1.1.md`
3. approved project documentation in `docs/`
4. original project brief

Follow `.ai/OPERATING_PROTOCOL.md`.

Do not one-shot the entire application.

For each task:

1. inspect the existing repository
2. read only the relevant context from `.ai/CONTEXT_MAP.md`
3. compare current state with approved behaviour
4. create or follow a bounded plan
5. implement only the approved scope
6. add/update tests
7. run relevant verification
8. report exactly what changed and what passed

Use the matching skill under `.ai/skills/` for database, analytics or security-sensitive changes.

Never invent KPI formulas, authorization rules, schema cardinalities or future-scope features.

If an approved document and the implementation conflict, treat the approved document as authoritative unless the task explicitly changes the design.
