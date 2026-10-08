# Completion decisions approved on 2026-10-07

Status: stakeholder approved both existing decisions during the remote-continuation review follow-up. This records current approval, not an inferred historical approval of the AI's earlier changes.

## CD-001: Own-password change

Authenticated users in each existing role must supply their current password to change their own password. Store the replacement with Argon2id. A successful change atomically revokes all active sessions and invalidates outstanding recovery links; the caller signs in again. Retain the existing self-service password-change audit event without credentials.

## CD-002: Missing data and missing target

For an evaluated KPI, if actual data is unavailable and no applicable target exists, return `NO_DATA`. If actual data exists but no applicable target exists, return `NO_TARGET`. Do not convert missing actual data into zero. Preserve scope/period/effective-date target applicability and the approved comparison rules.

## Authority and limits

These decisions resolve the two explicit policy blockers in F03 and F06c. They do not approve historical import promotion, new metrics, formulas, permissions, integrations or architectural changes. Existing golden calculations, zero/missing-data and target tests remain applicable.

The stakeholder selected “Approve both existing decisions” after being shown the exact password/session/recovery and missing-data/missing-target rules. The authorised [review follow-up plan](../plans/completion/review-follow-up.md) governs implementation and verification. Historical approval dates are not changed.
