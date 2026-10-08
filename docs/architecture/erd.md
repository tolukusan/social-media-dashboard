# Preliminary Entity Relationship Diagram

**Project:** Digital Marketing Performance Analytics and Monitoring System  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 2 — Domain & Data Model

## 1. Logical ERD

The 2026-10-08 [reporting currency addition](../decisions/ADR-009-reporting-currency-settings.md) adds a standalone singleton `ReportingSettings` table (`id`, nullable `reportingCurrency`, `updatedAt`) with no foreign keys. Existing relationships below remain unchanged.

```mermaid
erDiagram
    ROLE ||--o{ USER : assigns
    USER ||--o{ PASSWORD_RECOVERY_TOKEN : may_recover

    USER ||--o{ CAMPAIGN : responsible_for
    USER ||--o{ PERFORMANCE_RECORD : enters

    MARKETING_CHANNEL ||--o{ PLATFORM : contains
    MARKETING_CHANNEL ||--o{ CAMPAIGN_CHANNEL : selected_in
    CAMPAIGN ||--o{ CAMPAIGN_CHANNEL : uses

    CAMPAIGN_CHANNEL ||--o{ CAMPAIGN_PLATFORM : contains
    PLATFORM ||--o{ CAMPAIGN_PLATFORM : selected_as

    CAMPAIGN_PLATFORM ||--o{ PERFORMANCE_RECORD : produces

    PERFORMANCE_RECORD ||--o{ PERFORMANCE_METRIC_VALUE : contains
    METRIC_DEFINITION ||--o{ PERFORMANCE_METRIC_VALUE : identifies

    MARKETING_CHANNEL ||--o{ CHANNEL_METRIC : supports
    METRIC_DEFINITION ||--o{ CHANNEL_METRIC : applicable_as

    METRIC_DEFINITION ||--o{ KPI_DEFINITION : monitored_as
    KPI_DEFINITION ||--o{ KPI_TARGET : targets

    ROLE {
        uuid id PK
        string code UK
        string name
        boolean active
    }

    USER {
        uuid id PK
        uuid role_id FK
        string name
        string email UK
        string password_hash
        boolean active
        datetime last_login_at
        datetime created_at
        datetime updated_at
        datetime deactivated_at
    }

    PASSWORD_RECOVERY_TOKEN {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        string email_at_issue
        datetime created_at
        datetime expires_at
        datetime used_at
        datetime revoked_at
    }

    MARKETING_CHANNEL {
        uuid id PK
        string code UK
        string name
        string description
        boolean active
        datetime created_at
        datetime updated_at
        datetime archived_at
    }

    PLATFORM {
        uuid id PK
        uuid channel_id FK
        string code
        string name
        string description
        boolean active
        datetime created_at
        datetime updated_at
        datetime archived_at
    }

    CAMPAIGN {
        uuid id PK
        string name
        string description
        string objective
        string target_audience
        date start_date
        date end_date
        string status
        decimal budget
        uuid responsible_user_id FK
        uuid created_by_user_id FK
        uuid updated_by_user_id FK
        string notes
        datetime created_at
        datetime updated_at
        datetime archived_at
    }

    CAMPAIGN_CHANNEL {
        uuid id PK
        uuid campaign_id FK
        uuid channel_id FK
        datetime created_at
    }

    CAMPAIGN_PLATFORM {
        uuid id PK
        uuid campaign_channel_id FK
        uuid platform_id FK
        datetime created_at
    }

    METRIC_DEFINITION {
        uuid id PK
        string code UK
        string name
        string description
        string kind
        string unit
        boolean active
        datetime created_at
        datetime updated_at
    }

    CHANNEL_METRIC {
        uuid id PK
        uuid channel_id FK
        uuid metric_definition_id FK
        boolean input_enabled
        int display_order
        boolean active
    }

    PERFORMANCE_RECORD {
        uuid id PK
        uuid campaign_platform_id FK
        date record_date
        string notes
        string status
        uuid created_by_user_id FK
        uuid updated_by_user_id FK
        datetime created_at
        datetime updated_at
        datetime archived_at
    }

    PERFORMANCE_METRIC_VALUE {
        uuid id PK
        uuid performance_record_id FK
        uuid metric_definition_id FK
        decimal value
        datetime created_at
        datetime updated_at
    }

    KPI_DEFINITION {
        uuid id PK
        uuid metric_definition_id FK
        string name
        string description
        boolean active
        datetime created_at
        datetime updated_at
    }

    KPI_TARGET {
        uuid id PK
        uuid kpi_definition_id FK
        string period_type
        decimal target_value
        date effective_from
        date effective_to
        uuid created_by_user_id FK
        datetime created_at
        datetime updated_at
    }
```

## 2. Important Logical Unique Constraints

```text
ROLE(code)

USER(email)

MARKETING_CHANNEL(code)

PLATFORM(channel_id, code)

CAMPAIGN_CHANNEL(campaign_id, channel_id)

CAMPAIGN_PLATFORM(campaign_channel_id, platform_id)

CHANNEL_METRIC(channel_id, metric_definition_id)

PERFORMANCE_RECORD(campaign_platform_id, record_date)
  for active/non-archived rows

PERFORMANCE_METRIC_VALUE(performance_record_id, metric_definition_id)

METRIC_DEFINITION(code)
```

## 3. Important Relationship Validation

Some integrity rules cross more than one table and may require application-level validation or advanced database constraints.

### CampaignPlatform channel consistency

Given:

```text
CampaignPlatform
  → CampaignChannel
      → MarketingChannel A

CampaignPlatform
  → Platform
      → MarketingChannel B
```

A valid row requires:

```text
MarketingChannel A = MarketingChannel B
```

### Performance metric applicability

Given:

```text
PerformanceRecord
  → CampaignPlatform
  → CampaignChannel
  → MarketingChannel
```

a stored metric must exist in:

```text
ChannelMetric(channel, metric)
```

and must be a RAW input metric.

## 4. Not Yet Modelled

The following are intentionally deferred:

- exact KPI-target scope dimensions
- comparator rules
- audit log
- authentication sessions
- deployment-specific infrastructure
- third-party integrations
- persistent generated reports
- notifications
