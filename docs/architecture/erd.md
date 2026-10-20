# Preliminary Entity Relationship Diagram

**Project:** Digital Marketing Performance Analytics and Monitoring System  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 2 — Domain & Data Model

## 1. Logical ERD

The 2026-10-08 [integration addition](../decisions/ADR-011-live-integrations.md) adds `Platform → IntegrationConnection → IntegrationMapping / IntegrationRun`, with each mapping referencing exactly one campaign-platform (which has at most one mapping). Performance records may reference a mapping while retaining existing daily uniqueness. Connections reference their configuring user. All new foreign keys preserve historical references; credential values are absent from the schema.

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

## 5. Connected-account analytics extension (2026-10-14)

The following additive relationships support data whose source grain is a connected account or content object. They remain separate from `PerformanceRecord` and campaign KPI calculations.

```mermaid
erDiagram
    INTEGRATION_CONNECTION ||--o{ CONNECTED_ACCOUNT_ANALYTICS_RECORD : retrieves
    CONNECTED_ACCOUNT_ANALYTICS_RECORD ||--o{ CONNECTED_ACCOUNT_METRIC_VALUE : contains
    INTEGRATION_METRIC_DEFINITION ||--o{ CONNECTED_ACCOUNT_METRIC_VALUE : defines
    INTEGRATION_CONNECTION ||--o{ PERFORMANCE_METRIC_VALUE : sourced_by

    INTEGRATION_METRIC_DEFINITION {
        uuid id PK
        enum provider
        string code
        int definition_version
        string source_field
        string description
        enum unit
        enum aggregation_strategy
        string weighting_metric_code
        boolean non_negative
        int retention_days
    }

    CONNECTED_ACCOUNT_ANALYTICS_RECORD {
        uuid id PK
        uuid connection_id FK
        date record_date
        enum scope
        string source_object_id
        string source_api_version
        datetime retrieved_at
    }

    CONNECTED_ACCOUNT_METRIC_VALUE {
        uuid id PK
        uuid record_id FK
        uuid metric_definition_id FK
        decimal value
        datetime source_data_expires_at
    }
```

Unique keys are `(provider, code, definition_version)` for provider metrics, `(connection_id, record_date, scope, source_object_id)` for observations, and `(record_id, metric_definition_id)` for values. LinkedIn reporting values carry a source expiry; the API excludes expired values and deletes them through the provider-specific retention worker. Details: [ADR-012](../decisions/ADR-012-connected-account-analytics.md).

## 2026-10-18 additions

Role has many UserInvitation rows (restrictive role reference). RegistrationRequest retains resolution actor and approved-user identifiers as historical evidence. ArchiveDeletionConfirmation and DeletedPerformanceKey intentionally retain entity identifiers without entity foreign keys so confirmation consumption and deletion evidence survive entity removal. Existing entity relationships are unchanged; no organization or tenancy entity is introduced.

## 2026-10-20 connected-account sync jobs

```mermaid
erDiagram
    CONNECTED_ACCOUNT ||--o{ CONNECTED_ACCOUNT_SYNC_JOB : requests
    USER o|--o{ CONNECTED_ACCOUNT_SYNC_JOB : requested_by
    CONNECTED_ACCOUNT_SYNC_JOB ||--o{ CONNECTED_ACCOUNT_SYNC_CHUNK : checkpoints

    CONNECTED_ACCOUNT_SYNC_JOB {
        uuid id PK
        uuid connected_account_id FK
        date requested_from
        date requested_to
        date fetch_from
        date fetch_to
        enum source
        enum status
        uuid requested_by_user_id FK
        datetime created_at
        datetime started_at
        datetime updated_at
        datetime completed_at
        datetime lease_until
        uuid lease_token
        string sanitized_final_error_code
    }

    CONNECTED_ACCOUNT_SYNC_CHUNK {
        uuid id PK
        uuid job_id FK
        date from_date
        date to_date
        int sequence
        enum status
        int attempt_count
        datetime next_attempt_at
        int observation_count
        string sanitized_error_code
    }
```

At most one queued or running job can exist for a connected account. Chunk sequence is unique within a job and ordered newest to oldest. Jobs contain no credentials or raw provider responses and are retained for 30 days after completion. See [ADR-012](../decisions/ADR-012-connected-account-analytics.md) for the lifecycle and retention boundary.
