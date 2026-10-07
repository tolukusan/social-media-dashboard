# Current blockers

- **Package-gated UI/report work (F02/F07/F09):** Tailwind, Recharts, and a maintained server-side PDF renderer are not in the current lockfile. The original local workspace could not add packages because pnpm/corepack was blocked by NVM4306 and network restrictions. Do not hand-edit the lockfile or introduce custom substitutes merely to close the checklist.
- **F06a deployment currency:** The application now formats configured report currency correctly, but the deploying organisation must supply the approved `REPORTING_CURRENCY` value. Do not infer one.
- **Password-recovery delivery:** The recovery flow and SMTP adapter are implemented, but real inbox delivery requires an authorised SMTP provider/sender and credentials outside the repository.
- **F11 participant evidence:** The usability tasks are prepared, but actual participant feedback requires real participants and must not be fabricated.
- **F00 import provenance:** Original import scope-promotion approval was not found in active plans/ADRs. Preserve the existing import feature and formats; do not expand scope from this uncertainty.
- **M12 external deployment:** No authorised external deployment environment has been supplied. The deployment runbook is prepared, but no deployment is claimed.
- **Verification:** A PostgreSQL-backed CI workflow now contains lint, typecheck, unit, integration, build, Playwright, isolated backup/restore, authenticated k6 load, and documentation checks. Treat these as pending until a workflow run succeeds.

Resolved during TODO completion: own-password policy (current password required; all sessions/recovery links revoked), strict Origin enforcement for unsafe methods, and `NO_DATA` precedence when both actual data and an applicable target are absent.
