# Open Questions and Decision Register

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Open Questions and Decision Register  
**Version:** 1.0  
**Status:** Active Decision Register  
**Phase:** Step 1 — Requirements Decomposition

## 1. Purpose

This register records approved decisions and questions intentionally deferred to later design steps. Implementation agents must not silently override approved decisions or invent answers for deferred questions.

---

# 2. Approved Step 1 Decisions

## Q-001 — Single Organisation or Multi-Organisation?

**Priority:** Critical  
**Status:** Resolved  
**Decision:** The MVP shall support **one educational publishing organisation per deployment**.

### Rationale

The project is an academic PGD system and the brief does not require SaaS-style multi-tenancy. A single-organisation deployment keeps authentication, reporting, data ownership and demonstrations materially simpler.

### Impact

- no `organization_id` is required across core MVP tables
- no tenant middleware is required
- multi-tenant isolation is outside MVP scope
- architecture should avoid choices that make future multi-tenancy impossible

---

## Q-002 — Performance Record Time Granularity

**Priority:** Critical  
**Status:** Resolved  
**Decision:** Performance data shall be stored at **daily granularity** using a calendar `recordDate`.

### Rationale

Daily records are the simplest consistent base for trends and allow weekly, monthly, quarterly and yearly analytics to be derived without overlapping reporting windows.

### Impact

- one daily performance context can be aggregated upward
- trend lines use calendar dates
- monthly and quarterly comparisons are derived
- arbitrary multi-day source summaries are outside the initial input model

---

## Q-003 — Campaign to Marketing Channel Relationship

**Priority:** Critical  
**Status:** Resolved  
**Decision:** A campaign may use **multiple marketing channels**.

### Rationale

A real campaign may run simultaneously through social media, email, website and paid advertising. Restricting campaigns to one channel would distort the domain model.

### Impact

Use a many-to-many campaign/channel relationship rather than a single `campaign.channel_id`.

---

## Q-004 — Campaign to Platform Relationship

**Priority:** Critical  
**Status:** Resolved  
**Decision:** A campaign may use **multiple platforms**.

Platforms belong to a marketing channel.

### Example

- Channel: Social Media
- Platforms: Facebook, Instagram, TikTok

### Impact

Campaign/platform relationships must support multiple selected platforms. Platform records require a parent channel.

---

## Q-005 — Platform Catalogue Management

**Priority:** High  
**Status:** Resolved  
**Decision:** Use a **hybrid catalogue**.

The application shall ship with seeded common platforms and Administrators shall be able to add, edit, activate and deactivate additional platforms.

---

## Q-006 — Exact MVP Metric Catalogue

**Priority:** Critical  
**Status:** Resolved

### Social Media

Raw:
- Reach
- Impressions
- Engagements
- Link Clicks
- Followers Gained

Derived:
- Engagement Rate
- Click-Through Rate

### Website / Content

Raw:
- Users
- Sessions
- Page Views
- Conversions

Derived:
- Conversion Rate

### Email Marketing

Raw:
- Emails Sent
- Emails Delivered
- Opens
- Clicks
- Unsubscribes
- Conversions

Derived:
- Open Rate
- Click-Through Rate
- Conversion Rate

### Online Advertising

Raw:
- Impressions
- Reach
- Clicks
- Spend
- Conversions

Derived:
- Click-Through Rate
- Cost per Click
- Conversion Rate

### SEO

Raw:
- Organic Traffic
- Search Impressions
- Search Clicks
- Average Search Position

Derived:
- Search Click-Through Rate

Revenue and ROAS metrics are excluded until a revenue source is explicitly added.

---

## Q-007 — Stored or Derived KPI Values?

**Priority:** High  
**Status:** Resolved  
**Decision:** Store raw metric values as the source of truth. Calculate derived KPI values from raw metrics.

Persisted report output may contain a historical rendered value, but derived KPI columns shall not become the primary analytical source of truth.

---

## Q-008 — Management User Permissions

**Priority:** High  
**Status:** Resolved  
**Decision:** The Management role shall be **read-only for operational data** in the MVP.

Management users may:

- view dashboards
- view campaigns
- view analytics
- compare performance
- view/export reports

They shall not create, edit or delete users, campaigns, performance records, channels, platforms or KPI definitions.

---

## Q-009 — Marketing Officer Update/Delete Rights

**Priority:** High  
**Status:** Resolved  
**Decision:** Marketing Officers may create and update authorised campaign and performance data. They may not hard-delete important analytical records.

Deletion/archival permissions remain governed by the retention strategy in Q-011.

---

## Q-010 — Historical Attribution for Deactivated Users

**Priority:** High  
**Status:** Resolved  
**Decision:** Deactivating a user shall not remove or anonymise historical attribution. Historical records shall continue to reference the responsible/creating user.

---

## Q-011 — Deletion and Retention Strategy

**Priority:** High  
**Status:** Resolved  
**Decision:** Important domain records shall use **status, archive or soft-delete behaviour** rather than destructive hard deletion in normal application workflows.

Applicable records include:

- users
- channels
- platforms
- campaigns
- performance records
- KPI targets

Hard deletion may be reserved for controlled administrative maintenance outside normal user workflows.

---

## Q-012 — Responsible Personnel Representation

**Priority:** High  
**Status:** Resolved  
**Decision:** Campaign `responsible personnel` shall reference an existing active User.

The MVP shall support one primary responsible user per campaign. Multiple assignees may be added later.

---

## Q-013 — KPI Reporting Periods

**Priority:** Critical  
**Status:** Resolved  
**Decision:** KPI targets may use:

- daily
- weekly
- monthly
- quarterly
- yearly
- campaign-lifetime

Daily performance records are aggregated to evaluate larger periods.

---

## Q-014 — Target Ownership

**Priority:** High  
**Status:** Deferred to Step 4  
**Direction:** KPI targets should support a defined scope rather than being purely global. Exact target dimensions will be finalised in the KPI catalogue.

---

## Q-015 — KPI Status Rules

**Priority:** High  
**Status:** Deferred to Step 4  
**Direction:** Each KPI definition must specify comparison direction or range semantics. The system must not infer whether higher or lower values are desirable.

---

# 3. Reporting Decisions

## Q-016 — Report Persistence

**Priority:** Medium  
**Status:** Resolved  
**Decision:** MVP reports shall be generated **on demand**. A permanent `reports` domain table is not required solely for generated reports.

---

## Q-017 — Required Export Formats

**Priority:** Medium  
**Status:** Resolved  
**Decision:** **PDF export is required for the MVP.** CSV may be added if it does not delay core completion.

---

## Q-018 — Report Charts

**Priority:** Medium  
**Status:** Resolved  
**Decision:** PDF reports should include relevant charts where applicable. CSV output, if implemented, may remain tabular.

---

# 4. Dashboard and Analytics Decisions

## Q-019 — Default Dashboard Period

**Priority:** Medium  
**Status:** Resolved  
**Decision:** Default dashboard period shall be **current calendar month**.

---

## Q-020 — Comparison Semantics

**Priority:** High  
**Status:** Deferred to Step 4  
**Direction:** Preset period comparisons should use comparable calendar periods. Missing data must not automatically be treated as zero.

---

## Q-021 — Aggregate Rate Calculation

**Priority:** Critical  
**Status:** Resolved  
**Decision:** Aggregate raw numerator and denominator first, then calculate the derived rate.

Example:

`aggregate CTR = total clicks / total impressions × 100`

Do not calculate aggregate CTR by averaging individual row-level CTR percentages.

---

# 5. Data Entry Decisions

## Q-022 — Dynamic Metric Forms

**Priority:** High  
**Status:** Deferred to Step 2  
**Direction:** The UI should expose metrics relevant to the selected channel/platform. The underlying storage model will be decided during domain modelling.

---

## Q-023 — Duplicate Detection

**Priority:** High  
**Status:** Deferred to Step 2  
**Direction:** Duplicate rules shall use the approved daily granularity and the final performance-record schema.

---

## Q-024 — Data Correction History

**Priority:** Medium  
**Status:** Deferred to Step 6  
**Direction:** At minimum, records should retain creation/update metadata. Whether a full audit trail is required will be decided in the security/testing step.

---

# 6. User and Security Decisions

## Q-025 — Password Reset Flow

**Priority:** Medium  
**Status:** Resolved  
**Decision:** The MVP shall use **administrator-assisted password reset**. Email-based self-service recovery is outside initial scope.

---

## Q-026 — Audit Logging

**Priority:** Medium  
**Status:** Deferred to Step 6  
**Direction:** Candidate auditable events include user/role changes, data modification, archival/deletion actions and KPI-target changes.

---

# 7. Deployment and Scale Questions

## Q-027 — Demonstration Environment

**Priority:** Medium  
**Status:** Deferred to Step 5/6

The final deployment target will be selected with the technology stack.

---

## Q-028 — Expected User Volume

**Priority:** Medium  
**Status:** Deferred to Step 6

Expected scale will be defined before performance-test criteria are finalised.

---

# 8. Step 1 Exit Status

**Step 1 is Approved.**

Critical requirements questions required for domain modelling have been resolved:

- organisation model
- performance time granularity
- campaign/channel relationship
- campaign/platform relationship
- platform catalogue approach
- MVP metric catalogue
- KPI storage strategy
- KPI reporting periods
- rate aggregation semantics

Remaining questions are explicitly assigned to later steps and do not block domain modelling.

**Next phase: Step 2 — Domain & Data Model.**
