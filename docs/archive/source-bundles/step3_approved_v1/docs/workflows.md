# Core User Workflows

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Core User Workflows  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 3 — Roles, Permissions & Workflows

## 1. Purpose

This document defines the main user flows that the implementation must support.

A workflow defines:

- actor
- preconditions
- normal sequence
- validation
- resulting state
- authorization boundaries
- failure conditions

---

# 2. WF-001 — User Login

**Actors:** Administrator, Marketing Officer, Management

## Preconditions

- user account exists
- account is active

## Main Flow

1. User opens login page.
2. User enters email and password.
3. System validates the input.
4. System authenticates the credentials.
5. System checks that the user is active.
6. System creates an authenticated session.
7. System redirects the user to the appropriate dashboard/home area.

## Failure Cases

- missing email/password
- invalid credentials
- deactivated account
- session creation failure

## Result

Authenticated session is established.

---

# 3. WF-002 — Administrator Creates User

**Actor:** Administrator

## Preconditions

- Administrator is authenticated.

## Main Flow

1. Administrator opens user management.
2. Administrator selects Create User.
3. Administrator enters:
   - name
   - email
   - approved role
   - initial password/reset mechanism
4. System validates required fields.
5. System verifies email uniqueness.
6. System creates user.
7. System confirms successful creation.

## Failure Cases

- duplicate email
- invalid role
- missing required field
- unauthorised actor

---

# 4. WF-003 — Administrator Deactivates User

**Actor:** Administrator

## Main Flow

1. Administrator opens a user record.
2. Administrator selects Deactivate.
3. System requests confirmation.
4. Administrator confirms.
5. System marks the user inactive.
6. Historical records remain linked to the user.
7. Future authentication for the user is denied.

## Important Rule

Deactivation must not delete campaign or performance history.

---

# 5. WF-004 — Administrator Manages Channel

**Actor:** Administrator

## Main Flow

1. Administrator opens Channel Management.
2. Administrator creates or edits a channel.
3. System validates channel fields and unique code.
4. System saves changes.
5. Channel becomes available according to active state.

## Deactivation

Deactivating a channel:

- prevents new operational selection where appropriate
- does not delete historical campaign/performance relationships

---

# 6. WF-005 — Administrator Manages Platform

**Actor:** Administrator

## Preconditions

- parent channel exists

## Main Flow

1. Administrator selects a channel.
2. Administrator creates or edits a platform.
3. System validates:
   - platform name/code
   - parent channel
   - duplicate rules
4. System saves platform.
5. Platform is available for campaign configuration if active.

---

# 7. WF-006 — Create Campaign

**Actors:** Administrator, Marketing Officer

## Preconditions

- actor is authenticated
- at least one active channel exists
- at least one relevant active platform exists
- one active responsible User exists

## Main Flow

1. User opens Campaigns.
2. User selects Create Campaign.
3. User enters:
   - name
   - objective
   - description if needed
   - target audience
   - start date
   - optional end date
   - status
   - optional budget
   - responsible user
   - notes if needed
4. User selects one or more marketing channels.
5. For each selected channel, user selects one or more valid platforms.
6. System validates:
   - required fields
   - date consistency
   - budget
   - responsible user
   - platform/channel relationship
7. System creates Campaign.
8. System creates CampaignChannel rows.
9. System creates CampaignPlatform rows.
10. System confirms success.

## Failure Cases

- invalid dates
- inactive channel/platform
- platform does not belong to selected channel
- no channel selected
- no platform selected for a selected channel
- inactive responsible user
- unauthorised actor

---

# 8. WF-007 — Update Campaign

**Actors:** Administrator, Marketing Officer

## Preconditions

- campaign exists
- campaign is not administratively archived
- actor is authorised

## Main Flow

1. User opens campaign.
2. User selects Edit.
3. User modifies permitted fields.
4. System validates changes.
5. System updates campaign.
6. System updates channel/platform associations safely.
7. Existing performance history must not be silently orphaned.
8. System records updater metadata.
9. System confirms success.

## Important Design Rule

If a channel/platform already has historical performance records, removing that campaign association requires controlled behaviour.

The implementation must not simply delete the join row and break historical records.

Exact modification rules should be finalised before campaign editing is implemented.

---

# 9. WF-008 — Enter Daily Performance Data

**Actors:** Administrator, Marketing Officer

## Preconditions

- campaign exists
- CampaignPlatform exists
- campaign/platform combination is usable
- applicable metric definitions exist

## Main Flow

1. User opens Performance Data.
2. User selects Campaign.
3. User selects Channel.
4. User selects Platform.
5. User selects `recordDate`.
6. System loads raw metrics applicable to that channel.
7. User enters raw values.
8. System validates:
   - date
   - numeric values
   - metric applicability
   - duplicate daily record
   - non-negative constraints where applicable
9. System creates PerformanceRecord.
10. System creates PerformanceMetricValue rows.
11. System confirms success.
12. Derived metrics become available through analytics calculations.

## Important Rule

User does not manually enter derived metrics such as CTR or Engagement Rate.

---

# 10. WF-009 — Update Performance Data

**Actors:** Administrator, Marketing Officer

## Preconditions

- record exists
- record is active
- actor is authorised

## Main Flow

1. User opens an existing daily performance record.
2. User edits one or more raw values.
3. System validates all modified values.
4. System updates the raw metric values.
5. System updates modification metadata.
6. Derived analytics automatically reflect the new raw data.

## Result

No separate derived KPI row needs manual correction.

---

# 11. WF-010 — Archive Invalid Performance Record

**Actor:** Administrator

## Main Flow

1. Administrator opens performance record.
2. Administrator selects Archive.
3. System requests confirmation.
4. Administrator confirms.
5. Record is marked archived.
6. Record remains available for administrative history.
7. Normal dashboards and analytics exclude the archived record.

---

# 12. WF-011 — View Dashboard

**Actors:** Administrator, Marketing Officer, Management

## Main Flow

1. User opens Dashboard.
2. System defaults date filter to current calendar month.
3. System loads approved summary metrics.
4. System loads:
   - KPI cards
   - performance trends
   - channel performance
   - campaign performance
5. User may change filters:
   - date/period
   - channel
   - campaign
   - platform
   - KPI
6. System recalculates dashboard summaries using filtered raw data.
7. Derived rates are calculated using aggregate numerator/denominator rules.

## Result

Dashboard displays an internally consistent filtered view.

---

# 13. WF-012 — Compare Periods

**Actors:** Administrator, Marketing Officer, Management

## Main Flow

1. User opens Analytics/Comparison.
2. User selects a metric or KPI.
3. User selects two comparable periods or a preset comparison.
4. System retrieves raw values.
5. System aggregates each period.
6. System calculates derived values where required.
7. System displays:
   - period A
   - period B
   - absolute difference where meaningful
   - percentage change where meaningful
   - supporting chart/table

Missing data must not automatically be converted to zero unless the KPI rules explicitly say so.

---

# 14. WF-013 — Compare Channels

**Actors:** Administrator, Marketing Officer, Management

## Main Flow

1. User selects a reporting period.
2. User selects two or more channels.
3. User selects applicable metrics/KPIs.
4. System aggregates eligible records.
5. System displays comparable results.

## Validation

Only semantically comparable metrics should be placed into direct comparison.

---

# 15. WF-014 — Compare Campaigns

**Actors:** Administrator, Marketing Officer, Management

## Main Flow

1. User selects two or more campaigns.
2. User selects a period or campaign-lifetime context.
3. User selects applicable metrics.
4. System aggregates performance.
5. System displays comparison tables/charts.

---

# 16. WF-015 — Review Trends

**Actors:** Administrator, Marketing Officer, Management

## Main Flow

1. User selects a metric/KPI.
2. User selects a date range.
3. User optionally filters campaign/channel/platform.
4. System aggregates records by appropriate time interval.
5. System renders a time-series chart.

The MVP provides descriptive historical trends only.

---

# 17. WF-016 — Generate PDF Report

**Actors:** Administrator, Marketing Officer, Management

## Main Flow

1. User opens Reports.
2. User selects:
   - reporting period
   - optional campaign
   - optional channel
   - optional platform
   - optional KPI
3. System validates report filters.
4. System calculates report values.
5. System renders:
   - report title/scope
   - reporting period
   - relevant KPIs
   - summary statistics
   - comparisons where appropriate
   - charts where appropriate
   - generation date
6. User selects Export PDF.
7. System generates PDF.
8. User receives the generated report.

## MVP Rule

Generated reports are not required to be stored as permanent report records.

---

# 18. WF-017 — Management User Reviews Performance

**Actor:** Management

## Main Flow

1. Management user logs in.
2. User opens Dashboard or Analytics.
3. User applies filters.
4. User reviews KPIs, trends and comparisons.
5. User may generate/export a report.

## Restriction

No Create, Edit, Archive or configuration actions are available.

Backend authorization must enforce this restriction.

---

# 19. WF-018 — Administrator-Assisted Password Reset

**Actor:** Administrator

## Main Flow

1. User requests assistance outside the system or through organisational process.
2. Administrator opens User Management.
3. Administrator initiates password reset.
4. System applies the approved reset mechanism.
5. User signs in using the new/reset credential.
6. Existing password is no longer valid where applicable.

Email-based self-service password recovery is outside MVP scope.

---

# 20. Workflow Integrity Rules

## WIR-001

No workflow may bypass role authorization.

## WIR-002

No workflow may create a PerformanceMetricValue for a derived metric.

## WIR-003

No workflow may create a Platform under one channel and use it under another campaign channel.

## WIR-004

No workflow may create more than one active PerformanceRecord for the same CampaignPlatform and `recordDate`.

## WIR-005

No workflow may hard-delete historical analytical data through ordinary application operations.

## WIR-006

Archived performance records are excluded from normal analytics.

## WIR-007

Deactivated Users remain referenced by historical records.

## WIR-008

Changing raw performance values must immediately affect subsequently calculated analytics.

---

# 21. Workflow Test Map

| Workflow | Minimum Test Type |
|---|---|
| WF-001 Login | Functional + Security |
| WF-002 Create User | Functional + Validation + Authorization |
| WF-003 Deactivate User | Functional + Integration |
| WF-006 Create Campaign | Functional + Validation + Integration |
| WF-007 Update Campaign | Integration + Data Integrity |
| WF-008 Enter Performance | Functional + Validation + Integration |
| WF-009 Update Performance | Functional + Integration |
| WF-010 Archive Performance | Authorization + Integration |
| WF-011 Dashboard | Integration |
| WF-012 Period Comparison | Calculation + Integration |
| WF-013 Channel Comparison | Calculation + Integration |
| WF-014 Campaign Comparison | Calculation + Integration |
| WF-015 Trends | Calculation + Integration |
| WF-016 PDF Report | Functional + Integration |
| WF-017 Management Review | Authorization |
| WF-018 Password Reset | Functional + Security |

---

# 22. Approved Step 3 Workflow Decisions

## WQ-001 — Historical Campaign Association Removal

**Decision:** If a CampaignChannel or CampaignPlatform has historical PerformanceRecords, it shall not be physically removed.

Instead, it becomes inactive for future data entry while remaining available for historical analytics.

## WQ-002 — Completed Campaign Editing

**Decision:** Marketing Officers may correct non-structural metadata on a completed campaign.

Structural changes to channels/platforms after completion require Administrator action.

## WQ-003 — Future-Dated Performance Records

**Decision:** Future-dated performance records are not allowed.

`recordDate` must be on or before the current calendar date.

## WQ-004 — Performance Outside Campaign Dates

**Decision:** Performance data must fall within the campaign's effective dates.

If a valid historical record falls outside the recorded dates because the campaign dates were entered incorrectly, an authorised user must correct the campaign dates first.

---

# 23. Step 3 Approval Status

**Step 3 is Approved v1.0.**

Workflow rules are now stable enough for KPI and analytics specification.

Next phase:

**Step 4 — KPI & Analytics Semantics**
