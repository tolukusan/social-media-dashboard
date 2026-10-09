# Domain and Data Model

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Domain and Data Model  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 2 — Domain & Data Model  
**Depends on:** Step 1 Requirements Specification v1.0, Scope v1.0, Decision Register v1.0

## 1. Purpose

The 2026-10-08 [live integration addition](../decisions/ADR-011-live-integrations.md) activates the A-002 connected-source boundary: `Platform` has multiple `IntegrationConnection` accounts; connections have external-campaign `IntegrationMapping` rows and `IntegrationRun` history. A local `CampaignPlatform` has at most one integration mapping. `PerformanceRecord` optionally references that mapping and records whether the connector may still manage it. Existing rows are unmanaged by default. Credentials remain server configuration references; raw tokens are not database fields. Existing campaign, metric, and archive semantics below remain authoritative.

This document defines the logical domain model for the MVP before any framework, ORM or database engine is selected.

The model is designed to support:

- one educational publishing organisation per deployment
- three primary user roles
- multi-channel campaigns
- multi-platform campaigns
- daily performance-data entry
- channel-specific metrics
- stored raw metric values
- calculated derived metrics
- KPI targets
- dashboard aggregation
- comparisons and trends
- report generation
- historical data retention

This is a logical model. Database-specific types, indexes and ORM syntax will be finalised after the technology stack is approved.

---

# 2. Modelling Principles

## DM-001 — Raw Data Is the Source of Truth

Store raw performance values.

Derived values such as CTR, engagement rate and conversion rate shall be calculated from approved raw inputs.

Do not persist derived KPI values as the primary analytical source of truth.

## DM-002 — Daily Performance Grain

The basic performance-data grain is one calendar day.

Weekly, monthly, quarterly and yearly views are derived by aggregation.

## DM-003 — Campaigns Are Multi-Channel

A campaign may operate through multiple marketing channels.

## DM-004 — Channels Contain Platforms

A platform belongs to one marketing channel.

Examples:

- Social Media → Facebook
- Social Media → Instagram
- Email Marketing → Mailchimp
- Website / Content → Company Website
- Online Advertising → Google Ads

## DM-005 — Campaign Channels and Platforms Are Explicit

The database shall explicitly represent which channels and platforms are being used by a campaign.

## DM-006 — Metrics Are Configurable Definitions

Metrics shall be represented as definitions rather than hard-coded database columns.

This avoids a single performance table containing large numbers of channel-specific nullable fields.

## DM-007 — Historical References Are Preserved

Deactivating or archiving referenced records must not destroy historical interpretability.

## DM-008 — Normal User Workflows Do Not Hard Delete Analytical Records

Important records use activation, archival or soft-delete semantics where removal is required.

---

# 3. Core Domain Entities

## 3.1 Role

Represents one of the application's approved user roles.

### Initial seeded roles

- ADMIN
- MARKETING_OFFICER
- MANAGEMENT

### Core attributes

| Field       | Purpose                                |
| ----------- | -------------------------------------- |
| id          | Stable unique identifier               |
| code        | Stable machine-readable role code      |
| name        | Human-readable role name               |
| description | Optional explanation                   |
| active      | Whether role may currently be assigned |
| createdAt   | Creation timestamp                     |
| updatedAt   | Last update timestamp                  |

### Rules

- `code` must be unique.
- MVP roles are seeded.
- Dynamic permission editing is not required by the project brief.
- Authorization behaviour will be defined in the permissions matrix during Step 3.

---

## 3.2 User

Represents an authorised system user.

### Core attributes

| Field         | Purpose                         |
| ------------- | ------------------------------- |
| id            | Stable unique identifier        |
| roleId        | Assigned role                   |
| name          | User display name               |
| email         | Unique login identifier         |
| passwordHash  | Secure password representation  |
| active        | Whether login is permitted      |
| lastLoginAt   | Optional last successful login  |
| createdAt     | Creation timestamp              |
| updatedAt     | Last update timestamp           |
| deactivatedAt | Optional deactivation timestamp |

### Relationships

- User belongs to one Role.
- User may be responsible for multiple Campaigns.
- User may create/update multiple Performance Records.
- User may create/update KPI Targets where authorised.

### Rules

- Email must be unique.
- Deactivation must not delete the user.
- Historical records retain their user references.
- Password hashes must never be exposed in application responses.

### PasswordRecoveryToken (security workflow extension)

Represents one short-lived email credential for changing the password of its associated active User. It stores a unique token hash, the email address at issue time, creation/expiry timestamps, and optional use/revocation timestamps. One User may have multiple historical token rows; only an unused, unrevoked, unexpired token whose email snapshot still matches may be redeemed. This security workflow entity does not alter the one-role-per-user or campaign domain cardinalities.

---

## 3.3 MarketingChannel

Represents a broad digital marketing channel.

### Initial seeded channels

- Social Media Marketing
- Website / Content Marketing
- Email Marketing
- Search Engine Optimisation
- Online Advertising
- Other Digital Marketing Channels

### Core attributes

| Field       | Purpose                                  |
| ----------- | ---------------------------------------- |
| id          | Stable unique identifier                 |
| code        | Stable machine-readable code             |
| name        | Display name                             |
| description | Optional description                     |
| active      | Available for new campaign configuration |
| createdAt   | Creation timestamp                       |
| updatedAt   | Last update timestamp                    |
| archivedAt  | Optional archive timestamp               |

### Relationships

- MarketingChannel has many Platforms.
- MarketingChannel participates in many Campaigns through CampaignChannel.
- MarketingChannel supports many MetricDefinitions through ChannelMetric.

### Rules

- `code` must be unique.
- Deactivation shall not break historical records.

---

## 3.4 Platform

Represents a specific marketing platform within a channel.

### Examples

- Facebook
- Instagram
- TikTok
- Company Website
- Mailchimp
- Google Ads
- Google Search

### Core attributes

| Field       | Purpose                                  |
| ----------- | ---------------------------------------- |
| id          | Stable unique identifier                 |
| channelId   | Parent MarketingChannel                  |
| code        | Stable machine-readable code             |
| name        | Display name                             |
| description | Optional description                     |
| active      | Available for new campaign configuration |
| createdAt   | Creation timestamp                       |
| updatedAt   | Last update timestamp                    |
| archivedAt  | Optional archive timestamp               |

### Relationships

- Platform belongs to one MarketingChannel.
- Platform participates in campaigns through CampaignPlatform.

### Rules

- Platform code should be unique within its channel.
- Administrators may create additional platforms.
- Deactivated platforms remain available for historical interpretation.

---

## 3.5 Campaign

Represents a marketing campaign.

### Core attributes

| Field             | Purpose                            |
| ----------------- | ---------------------------------- |
| id                | Stable unique identifier           |
| name              | Campaign name                      |
| description       | Optional description               |
| objective         | Campaign objective                 |
| targetAudience    | Target audience description        |
| startDate         | Campaign start date                |
| endDate           | Optional campaign end date         |
| status            | Campaign lifecycle status          |
| budget            | Optional campaign budget           |
| responsibleUserId | Primary responsible User           |
| notes             | Optional notes                     |
| createdByUserId   | User who created the campaign      |
| updatedByUserId   | User who last updated the campaign |
| createdAt         | Creation timestamp                 |
| updatedAt         | Last update timestamp              |
| archivedAt        | Optional archive timestamp         |

### Initial statuses

- PLANNED
- ACTIVE
- COMPLETED
- SUSPENDED
- CANCELLED

### Relationships

- Campaign has one primary responsible User.
- Campaign has many CampaignChannels.
- Campaign ultimately has many CampaignPlatforms through CampaignChannel.
- Campaign has many PerformanceRecords through CampaignPlatform.

### Rules

- `startDate` is required.
- `endDate`, where present, must not precede `startDate`.
- Budget must not be negative.
- A campaign shall not be hard-deleted through normal user workflows.

---

## 3.6 CampaignChannel

Join entity representing a channel selected for a campaign.

### Core attributes

| Field      | Purpose                  |
| ---------- | ------------------------ |
| id         | Stable unique identifier |
| campaignId | Campaign                 |
| channelId  | MarketingChannel         |
| createdAt  | Creation timestamp       |

### Relationships

- belongs to one Campaign
- belongs to one MarketingChannel
- has many CampaignPlatforms

### Rules

The pair:

`campaignId + channelId`

must be unique.

This entity makes a campaign's channel participation explicit and prevents the Campaign table from being restricted to one channel.

---

## 3.7 CampaignPlatform

Join entity representing a specific platform selected under a campaign channel.

### Core attributes

| Field             | Purpose                  |
| ----------------- | ------------------------ |
| id                | Stable unique identifier |
| campaignChannelId | Parent CampaignChannel   |
| platformId        | Selected Platform        |
| createdAt         | Creation timestamp       |

### Relationships

- belongs to one CampaignChannel
- belongs to one Platform
- has many PerformanceRecords

### Rules

- The selected Platform must belong to the same MarketingChannel represented by the parent CampaignChannel.
- The pair `campaignChannelId + platformId` must be unique.

This structure prevents inconsistent combinations such as assigning a Google Ads platform to a Social Media campaign-channel row.

---

# 4. Metric Model

## 4.1 MetricDefinition

Represents a measurable digital marketing metric.

A metric definition may represent either raw input or a derived analytical value.

### Core attributes

| Field       | Purpose                                                     |
| ----------- | ----------------------------------------------------------- |
| id          | Stable unique identifier                                    |
| code        | Stable metric code                                          |
| name        | Display name                                                |
| description | Optional definition                                         |
| kind        | RAW or DERIVED                                              |
| unit        | COUNT, PERCENT, CURRENCY, POSITION or another approved unit |
| active      | Whether metric is currently available                       |
| createdAt   | Creation timestamp                                          |
| updatedAt   | Last update timestamp                                       |

### Examples

Raw:

- REACH
- IMPRESSIONS
- ENGAGEMENTS
- LINK_CLICKS
- USERS
- SESSIONS
- PAGE_VIEWS
- CONVERSIONS
- EMAILS_SENT
- EMAILS_DELIVERED
- EMAIL_OPENS
- UNSUBSCRIBES
- SPEND
- ORGANIC_TRAFFIC
- SEARCH_CLICKS
- AVG_SEARCH_POSITION

Derived:

- ENGAGEMENT_RATE
- CTR
- OPEN_RATE
- CONVERSION_RATE
- CPC

### Rules

- `code` must be unique.
- RAW values may be stored in PerformanceMetricValue.
- DERIVED values are calculated by the analytics engine.
- Exact aggregation behaviour is defined in Step 4.

---

## 4.2 ChannelMetric

Join entity defining which metrics apply to a MarketingChannel.

### Core attributes

| Field              | Purpose                                      |
| ------------------ | -------------------------------------------- |
| id                 | Stable unique identifier                     |
| channelId          | MarketingChannel                             |
| metricDefinitionId | MetricDefinition                             |
| inputEnabled       | Whether users may enter this metric directly |
| displayOrder       | Optional UI ordering                         |
| active             | Whether currently applicable                 |

### Rules

The pair:

`channelId + metricDefinitionId`

must be unique.

Derived metrics should normally have `inputEnabled = false`.

This table allows the UI to present different metric sets for Social Media, Website, Email, Advertising and SEO without changing the database schema.

---

# 5. Performance Data Model

## 5.1 PerformanceRecord

Represents one daily performance-data context for a campaign platform.

### Core attributes

| Field              | Purpose                                 |
| ------------------ | --------------------------------------- |
| id                 | Stable unique identifier                |
| campaignPlatformId | Campaign/platform context               |
| recordDate         | Calendar date represented by the record |
| notes              | Optional data-entry notes               |
| status             | ACTIVE or ARCHIVED                      |
| createdByUserId    | User who entered the record             |
| updatedByUserId    | User who last modified the record       |
| createdAt          | Creation timestamp                      |
| updatedAt          | Last update timestamp                   |
| archivedAt         | Optional archive timestamp              |

### Relationships

- belongs to one CampaignPlatform
- has many PerformanceMetricValues
- created/updated by Users

### Uniqueness

For the MVP:

`campaignPlatformId + recordDate`

must identify at most one active daily performance record.

This gives one daily record containing the applicable raw metric values for that campaign/platform context.

### Example

Campaign: Back to School 2026  
Channel: Social Media  
Platform: Instagram  
Date: 2026-09-23

PerformanceRecord represents that context.

Its child values might be:

- Reach = 15,000
- Impressions = 20,000
- Engagements = 1,200
- Link Clicks = 450
- Followers Gained = 35

---

## 5.2 PerformanceMetricValue

Stores one raw metric value belonging to a PerformanceRecord.

### Core attributes

| Field               | Purpose                   |
| ------------------- | ------------------------- |
| id                  | Stable unique identifier  |
| performanceRecordId | Parent PerformanceRecord  |
| metricDefinitionId  | Raw metric being recorded |
| value               | Numeric value             |
| createdAt           | Creation timestamp        |
| updatedAt           | Last update timestamp     |

### Rules

The pair:

`performanceRecordId + metricDefinitionId`

must be unique.

Additional rules:

- only RAW metrics may be persisted here
- metric must be active/applicable to the record's channel
- values must satisfy the metric's validation rules
- derived percentages shall not be manually entered into this table

---

# 6. KPI Model

## 6.1 KpiDefinition

Represents a metric formally selected for KPI monitoring.

### Proposed attributes

| Field              | Purpose                            |
| ------------------ | ---------------------------------- |
| id                 | Stable unique identifier           |
| metricDefinitionId | Metric being monitored             |
| name               | KPI display name                   |
| description        | Optional explanation               |
| active             | Whether KPI is currently monitored |
| createdAt          | Creation timestamp                 |
| updatedAt          | Last update timestamp              |

### Relationships

- references one MetricDefinition
- has many KpiTargets

### Note

Comparison direction, target semantics and exact KPI behaviour are intentionally finalised in Step 4.

---

## 6.2 KpiTarget

Represents an organisational target for a KPI.

### Confirmed conceptual attributes

| Field           | Purpose                                               |
| --------------- | ----------------------------------------------------- |
| id              | Stable unique identifier                              |
| kpiDefinitionId | KPI being targeted                                    |
| periodType      | DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY or CAMPAIGN |
| targetValue     | Target value                                          |
| effectiveFrom   | When target starts applying                           |
| effectiveTo     | Optional end                                          |
| createdByUserId | User who created target                               |
| createdAt       | Creation timestamp                                    |
| updatedAt       | Last update timestamp                                 |

### Scope

Exact target scoping is deferred to Step 4.

Potential scope dimensions include:

- system-wide
- channel
- platform
- campaign

The physical schema must not be finalised until target ownership semantics are approved.

---

# 7. Entities Explicitly Excluded from the MVP Domain Model

## Organisation / Tenant

Not required because the MVP supports one organisation per deployment.

## Persisted Report

Reports are generated on demand in the MVP.

A permanent Report entity is not currently required.

## ThirdPartyIntegration / ApiCredential

Live third-party integrations are outside the MVP.

## Prediction / AIRecommendation

Predictive analytics and AI-generated recommendations are outside the MVP.

## SocialPost / Publication

Social-media publishing is outside the MVP.

---

# 8. Cross-Cutting Entities Deferred to Later Steps

The following may be introduced after security/architecture analysis:

## AuditLog

Potentially records important changes such as:

- user and role changes
- performance-data changes
- archival actions
- KPI-target changes

Final scope is Step 6.

## Session

Authentication session persistence depends on the selected authentication architecture and framework.

Final design is Step 5.

## SystemSetting

The project brief mentions system settings but does not define concrete settings.

Do not create a generic settings table until an actual setting requires persistence.

The stakeholder's 2026-10-08 request supplies that concrete need: a dedicated singleton `ReportingSettings` stores one nullable reporting currency, managed by an Administrator. It has no organisation/tenant relation and changes no existing cardinalities or analytical amounts. See [ADR-009](../decisions/ADR-009-reporting-currency-settings.md).

---

# 9. Relationship Summary

```text
Role
  1 ──────── * User

User
  1 ──────── * Campaign              (responsible user)
  1 ──────── * PerformanceRecord     (created/updated by)

MarketingChannel
  1 ──────── * Platform

Campaign
  1 ──────── * CampaignChannel

MarketingChannel
  1 ──────── * CampaignChannel

CampaignChannel
  1 ──────── * CampaignPlatform

Platform
  1 ──────── * CampaignPlatform

CampaignPlatform
  1 ──────── * PerformanceRecord

PerformanceRecord
  1 ──────── * PerformanceMetricValue

MetricDefinition
  1 ──────── * PerformanceMetricValue

MarketingChannel
  * ──────── * MetricDefinition
      via ChannelMetric

MetricDefinition
  1 ──────── * KpiDefinition

KpiDefinition
  1 ──────── * KpiTarget
```

---

# 10. Core Integrity Rules

## INT-001

A Platform must belong to exactly one MarketingChannel.

## INT-002

A CampaignChannel must reference an existing Campaign and MarketingChannel.

## INT-003

A Campaign may not contain the same MarketingChannel more than once.

## INT-004

A CampaignPlatform must use a Platform belonging to its CampaignChannel's MarketingChannel.

## INT-005

A CampaignPlatform may not contain the same Platform twice under one CampaignChannel.

## INT-006

A PerformanceRecord must reference an approved CampaignPlatform.

## INT-007

A CampaignPlatform may have only one active PerformanceRecord for a calendar date.

## INT-008

A PerformanceMetricValue may appear only once for a given PerformanceRecord and MetricDefinition.

## INT-009

PerformanceMetricValue may store only RAW MetricDefinitions.

## INT-010

A stored metric must be applicable to the MarketingChannel represented by its CampaignPlatform.

## INT-011

Negative values shall be rejected for metrics for which negative values are invalid.

## INT-012

Archived/deactivated domain records shall retain historical references.

## INT-013

Campaign end date may not precede campaign start date.

## INT-014

Derived metrics shall be calculated from source values according to the KPI catalogue.

## INT-015

Aggregate rates shall be calculated from aggregate numerators and denominators rather than by averaging row percentages unless explicitly defined otherwise.

---

# 11. Example Data Path

A Marketing Officer enters Instagram performance for a campaign:

```text
User
  ↓
Campaign
  ↓
CampaignChannel: Social Media
  ↓
CampaignPlatform: Instagram
  ↓
PerformanceRecord: 2026-09-23
  ↓
PerformanceMetricValues
    Reach = 15000
    Impressions = 20000
    Engagements = 1200
    Link Clicks = 450
```

The analytics engine later computes:

```text
Engagement Rate
= aggregate engagements / aggregate reach × 100

CTR
= aggregate link clicks / aggregate impressions × 100
```

No Engagement Rate or CTR row needs to be manually entered.

---

# 12. Why the Metric-Value Model Is Preferred

An alternative would be a table such as:

```text
performance_records
- reach
- impressions
- engagements
- link_clicks
- followers
- users
- sessions
- page_views
- email_sent
- email_delivered
- opens
- unsubscribes
- spend
- organic_traffic
- search_position
- ...
```

That model would create many channel-specific null columns and make adding or removing metrics a schema change.

The selected model instead separates:

```text
PerformanceRecord
        ↓
PerformanceMetricValue
        ↓
MetricDefinition
```

Benefits:

- channel-specific forms without channel-specific tables
- fewer nullable columns
- easier metric catalogue changes
- consistent analytics pipeline
- easier future API ingestion
- clearer validation
- simpler historical extension

Trade-off:

Analytics queries require joins and aggregation.

This trade-off is acceptable for the expected academic MVP scale and gives a more coherent domain model.

---

# 13. Approved Step 2 Decisions

## DQ-001 — Performance Record Platform Requirement

**Decision:** Every PerformanceRecord shall reference a CampaignPlatform.

Where a marketing channel does not naturally map to a named third-party platform, the seeded catalogue may include a generic platform such as `Company Website`, `Direct Email`, or another approved channel-specific platform.

This keeps performance context consistent and avoids nullable platform relationships.

## DQ-002 — Metric Value Numeric Representation

**Decision:** Metric values are logically numeric and shall use a decimal-compatible representation in the physical database where appropriate.

Exact physical types will be selected with the database technology in Step 5.

## DQ-003 — Campaign Name Uniqueness

**Decision:** Campaign names are not globally unique.

Campaign identity is determined by the campaign ID. The same campaign name may legitimately recur across years, product cycles or reporting periods.

## DQ-004 — User Login Identifier

**Decision:** User email shall be the unique login identifier for the MVP.

## DQ-005 — Role Storage

**Decision:** Roles shall be persisted as seeded Role records.

The MVP shall not include a dynamic permission-builder UI.

## DQ-006 — Metric Definition Editing

**Decision:** The approved MVP metric definitions shall be seeded and not arbitrarily created by Administrators.

Administrators may activate/deactivate supported metrics if later approved, but defining arbitrary derived metrics and formulas is outside the MVP.

---

# 14. Step 2 Approval Status

**Step 2 is Approved v1.0.**

Approved domain-model decisions include:

- one Role per User
- email as unique login identifier
- seeded roles
- multi-channel campaigns
- multi-platform campaigns
- platforms belong to channels
- CampaignChannel and CampaignPlatform join entities
- one daily PerformanceRecord per CampaignPlatform
- every PerformanceRecord requires a CampaignPlatform
- raw metric/value storage through MetricDefinition and PerformanceMetricValue
- seeded approved MVP metric definitions
- derived metrics are calculated rather than manually entered
- campaign names need not be unique
- logical decimal-compatible numeric metric values
- historical references preserved after deactivation/archive

Next phase:

**Step 3 — Roles, Permissions & Workflows**
