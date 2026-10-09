# Roles and Permissions Matrix

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Roles and Permissions Matrix  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 3 — Roles, Permissions & Workflows  
**Depends on:** Step 1 Approved v1.0, Step 2 Approved v1.0

## 1. Purpose

This document defines what each approved user role may view or change in the MVP.

The application has three roles:

- ADMIN
- MARKETING_OFFICER
- MANAGEMENT

The MVP shall use fixed role behaviour. A dynamic permission-builder is outside scope.

---

# 2. Permission Principles

## PERM-001 — Least Privilege

Users shall receive only the permissions required for their approved responsibilities.

## PERM-002 — Server-Side Enforcement

Permissions must be enforced by backend/application authorization logic.

Hiding a button in the interface is not sufficient authorization.

## PERM-003 — Management Is Read-Only

Management users consume dashboards, analytics and reports and shall not modify operational records.

## PERM-004 — Marketing Officers Operate Marketing Data

Marketing Officers may create and update authorised campaign/performance information but may not administer users, roles or system configuration.

## PERM-005 — Administrator Controls System Configuration

Administrators manage users, channels, platforms and relevant system configuration.

The stakeholder-authorised 2026-10-08 [integration addition](../decisions/ADR-011-live-integrations.md) applies this boundary to provider connections, campaign mappings, schedules, disconnection, and resumption: Administrators configure these resources. All authenticated roles may view connection metadata and runs. Administrators and Marketing Officers may request manual performance syncs. Management remains read-only. Scheduled imports require an active configuring Administrator.

The 2026-10-08 application configuration follow-up applies this rule to reporting currency: all authenticated roles may read the code, and only Administrators may update it. See [ADR-009](../decisions/ADR-009-reporting-currency-settings.md).

## PERM-006 — No Normal Hard Delete

The stakeholder's 2026-10-08 import deletion follow-up permits Administrators to delete uncommitted import staging only. Marketing Officers and Management cannot delete imports. Completed/processing imports and imports referenced by active or archived performance records are protected; performance data is never deleted by this workflow. See [ADR-010](../decisions/ADR-010-import-deletion.md).

Normal application workflows shall use archive/deactivation semantics for important analytical records.

---

# 3. Permission Legend

| Code | Meaning                         |
| ---- | ------------------------------- |
| V    | View                            |
| C    | Create                          |
| U    | Update                          |
| A    | Archive / Deactivate            |
| E    | Export                          |
| M    | Manage / Administrative control |
| -    | Not permitted                   |

---

# 4. High-Level Permission Matrix

| Resource / Capability                 | Administrator | Marketing Officer | Management |
| ------------------------------------- | ------------- | ----------------- | ---------- |
| Login / Logout                        | V             | V                 | V          |
| Own profile                           | V/U           | V/U               | V/U        |
| Change own password                   | U             | U                 | U          |
| User list                             | V             | -                 | -          |
| Create users                          | C             | -                 | -          |
| Update users                          | U             | -                 | -          |
| Activate/deactivate users             | A             | -                 | -          |
| Assign roles                          | M             | -                 | -          |
| View roles                            | V             | -                 | -          |
| Manage roles dynamically              | -             | -                 | -          |
| View channels                         | V             | V                 | V          |
| Create channels                       | C             | -                 | -          |
| Update channels                       | U             | -                 | -          |
| Activate/deactivate channels          | A             | -                 | -          |
| View platforms                        | V             | V                 | V          |
| Create platforms                      | C             | -                 | -          |
| Update platforms                      | U             | -                 | -          |
| Activate/deactivate platforms         | A             | -                 | -          |
| View campaigns                        | V             | V                 | V          |
| Create campaigns                      | C             | C                 | -          |
| Update campaigns                      | U             | U                 | -          |
| Archive campaigns                     | A             | -                 | -          |
| View performance records              | V             | V                 | V          |
| Create performance records            | C             | C                 | -          |
| Update performance records            | U             | U                 | -          |
| Archive performance records           | A             | -                 | -          |
| View metric definitions               | V             | V                 | V          |
| Create arbitrary metrics              | -             | -                 | -          |
| Activate/deactivate supported metrics | M*            | -                 | -          |
| View KPI definitions                  | V             | V                 | V          |
| Manage KPI definitions                | M*            | -                 | -          |
| View KPI targets                      | V             | V                 | V          |
| Create KPI targets                    | M*            | -                 | -          |
| Update KPI targets                    | M*            | -                 | -          |
| View dashboard                        | V             | V                 | V          |
| Filter dashboard                      | V             | V                 | V          |
| View analytics                        | V             | V                 | V          |
| Compare periods/channels/campaigns    | V             | V                 | V          |
| View trends                           | V             | V                 | V          |
| Generate report                       | V             | V                 | V          |
| Export PDF report                     | E             | E                 | E          |
| View audit information if implemented | V             | -                 | -          |

`M*` indicates behaviour to be finalised during Step 4 or Step 6.

---

# 5. Administrator Permissions

## 5.1 Users

Administrator may:

- list users
- view user details
- create users
- assign one approved role
- update user details
- activate users
- deactivate users
- perform administrator-assisted password reset

Administrator shall not:

- permanently remove historical attribution through deactivation
- create arbitrary new role types through the MVP UI unless scope is changed

## 5.2 Channels and Platforms

Administrator may:

- view all channels
- create channels
- edit channels
- activate/deactivate channels
- view all platforms
- create platforms
- edit platforms
- activate/deactivate platforms

Administrator actions must preserve existing historical references.

## 5.3 Campaigns

Administrator may:

- view all campaigns
- create campaigns
- update campaigns
- archive campaigns

Administrator archive capability is intended for controlled correction/administration, not routine deletion.

## 5.4 Performance Data

Administrator may:

- view performance records
- create records where needed
- update records
- archive invalid records

Administrative corrections should retain creation/update metadata.

## 5.5 Analytics and Reports

Administrator may:

- view all dashboards
- use filters
- run comparisons
- view trends
- generate and export reports

---

# 6. Marketing Officer Permissions

## 6.1 Campaigns

Marketing Officers may:

- view campaigns
- create campaigns
- update active/non-archived campaigns

They shall not:

- archive campaigns in the MVP
- change system channels/platform definitions
- manage users or roles

## 6.2 Performance Data

Marketing Officers may:

- view performance records
- create daily performance records
- update authorised performance records

They shall not:

- hard-delete performance records
- archive records in the MVP unless later approved
- enter derived KPI values manually

## 6.3 Analytics and Reports

Marketing Officers may:

- view dashboards
- filter dashboards
- view analytics
- compare periods
- compare channels
- compare campaigns
- view trends
- generate reports
- export PDF reports

---

# 7. Management Permissions

Management users are read-only for operational data.

They may:

- view campaigns
- view channels/platforms
- view performance information
- view KPI definitions and targets
- view dashboards
- filter dashboards
- run comparisons
- review trends
- generate reports
- export PDF reports

They shall not:

- create or modify users
- create or modify campaigns
- enter or edit performance data
- create or modify channels/platforms
- configure metrics
- define targets
- archive data

---

# 8. Ownership Rules

The project brief defines roles but does not require per-user record ownership restrictions.

Therefore the MVP shall initially use role-based access rather than "only records created by me" restrictions.

### Decision

A Marketing Officer may view and update marketing records available to the Marketing Officer role, regardless of which Marketing Officer originally entered them.

### Rationale

- simpler for a small organisational team
- avoids data becoming inaccessible when staff change
- aligns with organisational rather than personal ownership
- historical creator/updater attribution is still retained

Per-user ownership controls may be added later if required.

---

# 9. Record State Rules

## Users

- Active
- Deactivated

## Channels / Platforms

- Active
- Deactivated / Archived

## Campaigns

Lifecycle status:

- Planned
- Active
- Completed
- Suspended
- Cancelled

Additionally, an administrative archive state may hide a campaign from normal operations without destroying history.

## Performance Records

- Active
- Archived

Archived performance records must be excluded from normal analytics unless an explicit administrative view includes them.

---

# 10. Authorization Failure Behaviour

When a user attempts an unauthorised action:

- the backend shall reject the request
- the action shall not modify data
- the response shall not reveal sensitive implementation detail
- the UI should show an understandable access-denied message where applicable

Authenticated-but-forbidden access should be distinguished from unauthenticated access in the application layer.

---

# 11. Permission Test Requirements

At minimum, automated or integration tests shall verify:

- unauthenticated users cannot access protected resources
- Administrator can manage users
- Marketing Officer cannot manage users
- Management cannot modify campaigns
- Management cannot modify performance records
- Marketing Officer can create/update authorised campaign data
- Marketing Officer can create/update performance data
- only Administrator can deactivate users/channels/platforms
- all roles can view dashboards according to their access
- all roles can generate/export reports
- UI restrictions are backed by server-side authorization

---

# 12. Approved Step 3 Decisions

## PQ-001 — KPI Target Administration

**Decision:** Administrator only for the MVP.

Administrators may create and update approved KPI targets. Marketing Officers and Management users may view them.

## PQ-002 — KPI Definition Administration

**Decision:** KPI definitions are seeded from the approved KPI catalogue.

Administrators may activate or deactivate approved KPI definitions if the UI exposes that control, but arbitrary KPI formulas may not be created in the MVP.

## PQ-003 — Campaign Archive Permission

**Decision:** Administrator only.

Marketing Officers may create and update campaigns but shall not archive them.

## PQ-004 — Performance Archive Permission

**Decision:** Administrator only.

Marketing Officers may correct raw values on active records. Invalid records requiring removal from analytics are archived by an Administrator.

## PQ-005 — User Profile Editing

**Decision:** Users may edit their own display name and change their password.

Email changes require Administrator action because email is the login identifier.

---

# 13. Step 3 Approval Status

**Step 3 is Approved v1.0.**

Approved rules include:

- Administrator manages users, channels, platforms and archival actions
- Marketing Officer creates and updates campaigns and performance data
- Management is read-only for operational data
- all three roles may use dashboards, analytics, comparisons and reports
- role-based authorization is enforced server-side
- normal workflows do not hard-delete analytical records
- Marketing Officers may correct but not archive performance records
- KPI targets are Administrator-managed
- KPI definitions are seeded from the approved catalogue
- user email changes require Administrator
- users may update their own display name and password
- organisational records are role-controlled, not privately owned by their creator

Next phase:

**Step 4 — KPI & Analytics Semantics**
