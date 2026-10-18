CREATE TYPE "social_media_dashboard"."AccountAnalyticsDataScope" AS ENUM (
  'LIFETIME', 'DATE_RANGE', 'CUMULATIVE'
);

ALTER TABLE "social_media_dashboard"."ConnectedAccount"
  ALTER COLUMN "credentialCiphertext" DROP NOT NULL;

ALTER TABLE "social_media_dashboard"."ConnectedAccountAnalyticsRecord"
  ALTER COLUMN "connectionId" DROP NOT NULL,
  ALTER COLUMN "sourceObjectId" TYPE VARCHAR(180),
  ALTER COLUMN "sourceApiVersion" TYPE VARCHAR(80),
  ADD COLUMN "connectedAccountId" UUID,
  ADD COLUMN "sourceObservationKey" VARCHAR(512),
  ADD COLUMN "objectTitle" VARCHAR(500),
  ADD COLUMN "objectType" VARCHAR(80),
  ADD COLUMN "objectUrl" VARCHAR(1000),
  ADD COLUMN "objectOccurredAt" TIMESTAMP(3),
  ADD COLUMN "periodFrom" DATE,
  ADD COLUMN "periodTo" DATE,
  ADD COLUMN "dataScope" "social_media_dashboard"."AccountAnalyticsDataScope";

ALTER TABLE "social_media_dashboard"."ConnectedAccountAnalyticsRecord"
  DROP CONSTRAINT "ConnectedAccountAnalyticsRecord_scope_identity",
  ADD CONSTRAINT "ConnectedAccountAnalyticsRecord_source_check"
    CHECK (("connectionId" IS NOT NULL AND "connectedAccountId" IS NULL AND "sourceObservationKey" IS NULL)
      OR ("connectionId" IS NULL AND "connectedAccountId" IS NOT NULL AND "sourceObservationKey" IS NOT NULL)),
  ADD CONSTRAINT "ConnectedAccountAnalyticsRecord_period_check"
    CHECK ("periodFrom" IS NULL OR "periodTo" IS NULL OR "periodFrom" <= "periodTo"),
  ADD CONSTRAINT "ConnectedAccountAnalyticsRecord_scope_identity"
    CHECK (
      ("scope" = 'ACCOUNT' AND "sourceObjectId" = 'ACCOUNT' AND "dataScope" IS NULL)
      OR
      ("scope" = 'CONTENT' AND "sourceObjectId" <> 'ACCOUNT' AND (
        ("connectedAccountId" IS NULL AND "dataScope" IS NULL)
        OR ("connectedAccountId" IS NOT NULL AND "dataScope" IN ('LIFETIME', 'DATE_RANGE'))
      ))
      OR
      ("scope" = 'EMAIL_CAMPAIGN' AND "connectedAccountId" IS NOT NULL
        AND "sourceObjectId" <> 'ACCOUNT' AND "dataScope" = 'CUMULATIVE')
    );

CREATE INDEX "ConnectedAccountAnalyticsRecord_connectedAccountId_scope_recordDate_idx"
  ON "social_media_dashboard"."ConnectedAccountAnalyticsRecord"("connectedAccountId", "scope", "recordDate");
CREATE INDEX "ConnectedAccountAnalyticsRecord_connectedAccountId_scope_objectOccurredAt_idx"
  ON "social_media_dashboard"."ConnectedAccountAnalyticsRecord"("connectedAccountId", "scope", "objectOccurredAt");
CREATE UNIQUE INDEX "ConnectedAccountAnalyticsRecord_connectedAccountId_sourceObservationKey_key"
  ON "social_media_dashboard"."ConnectedAccountAnalyticsRecord"("connectedAccountId", "sourceObservationKey");

ALTER TABLE "social_media_dashboard"."ConnectedAccountAnalyticsRecord"
  ADD CONSTRAINT "ConnectedAccountAnalyticsRecord_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "social_media_dashboard"."ConnectedAccount"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

WITH legacy_observations AS (
  SELECT
    CASE account."provider"::text
      WHEN 'INSTAGRAM' THEN 'INSTAGRAM_ORGANIC'
      WHEN 'FACEBOOK' THEN 'FACEBOOK_ORGANIC'
      WHEN 'LINKEDIN' THEN 'LINKEDIN_ORGANIC'
      WHEN 'YOUTUBE' THEN 'YOUTUBE_ANALYTICS'
      WHEN 'ZOHO_CAMPAIGNS' THEN 'ZOHO_CAMPAIGNS'
    END AS provider,
    metric."metricCode" AS code,
    'ACCOUNT' AS scope,
    metric."sourceMetric" AS source_field,
    metric."scope"::text AS legacy_grain
  FROM "social_media_dashboard"."AccountDailyMetric" metric
  JOIN "social_media_dashboard"."ConnectedAccount" account ON account."id" = metric."accountId"
  UNION ALL
  SELECT
    CASE account."provider"::text
      WHEN 'INSTAGRAM' THEN 'INSTAGRAM_ORGANIC'
      WHEN 'FACEBOOK' THEN 'FACEBOOK_ORGANIC'
      WHEN 'LINKEDIN' THEN 'LINKEDIN_ORGANIC'
      WHEN 'YOUTUBE' THEN 'YOUTUBE_ANALYTICS'
      WHEN 'ZOHO_CAMPAIGNS' THEN 'ZOHO_CAMPAIGNS'
    END,
    metric.key,
    'CONTENT',
    metric.key,
    'CONTENT'
  FROM "social_media_dashboard"."AccountPostSnapshot" post
  JOIN "social_media_dashboard"."ConnectedAccount" account ON account."id" = post."accountId"
  CROSS JOIN LATERAL jsonb_object_keys(post."metricValues") AS metric(key)
  UNION ALL
  SELECT
    'ZOHO_CAMPAIGNS',
    metric.key,
    'EMAIL_CAMPAIGN',
    metric.key,
    'CUMULATIVE'
  FROM "social_media_dashboard"."EmailCampaignSnapshot" campaign
  CROSS JOIN LATERAL jsonb_object_keys(campaign."metricValues") AS metric(key)
), grouped_definitions AS (
  SELECT
    provider,
    code,
    scope,
    max(source_field) AS source_field,
    bool_or(legacy_grain = 'SNAPSHOT') AS has_snapshot_values
  FROM legacy_observations
  WHERE provider IS NOT NULL
  GROUP BY provider, code, scope
), definition_values AS (
  SELECT
    provider::"social_media_dashboard"."IntegrationProvider" AS provider,
    code,
    scope::"social_media_dashboard"."AccountAnalyticsScope" AS scope,
    code AS name,
    'Migrated provider metric. Source field: ' || source_field AS description,
    left(source_field, 120) AS source_field,
    CASE
      WHEN code IN ('OPEN_RATE', 'UNIQUE_CLICK_RATE') THEN 'PERCENT'
      WHEN code = 'WATCH_TIME_MINUTES' THEN 'DECIMAL'
      ELSE 'COUNT'
    END::"social_media_dashboard"."MetricUnit" AS unit,
    CASE
      WHEN scope = 'EMAIL_CAMPAIGN' AND code IN ('OPEN_RATE', 'UNIQUE_CLICK_RATE') THEN 'WEIGHTED_AVERAGE'
      WHEN scope = 'EMAIL_CAMPAIGN' THEN 'SUM'
      WHEN scope = 'CONTENT' OR code = 'AUDIENCE_SIZE' OR (scope = 'ACCOUNT' AND has_snapshot_values) THEN 'LAST'
      ELSE 'SUM'
    END::"social_media_dashboard"."AggregationStrategy" AS aggregation_strategy,
    CASE WHEN code IN ('OPEN_RATE', 'UNIQUE_CLICK_RATE') THEN 'DELIVERED' END AS weighting_metric_code,
    CASE
      WHEN provider IN ('INSTAGRAM_ORGANIC', 'FACEBOOK_ORGANIC') THEN 90
      WHEN provider = 'LINKEDIN_ORGANIC' AND scope = 'CONTENT' THEN 42
      WHEN provider = 'LINKEDIN_ORGANIC' THEN 364
    END AS retention_days
  FROM grouped_definitions
)
INSERT INTO "social_media_dashboard"."IntegrationMetricDefinition" (
  "id", "provider", "code", "scope", "name", "description", "sourceField",
  "definitionVersion", "unit", "aggregationStrategy", "weightingMetricCode",
  "nonNegative", "retentionDays", "active", "createdAt", "updatedAt"
)
SELECT
  (substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-' || substr(hash.value, 13, 4) || '-' || substr(hash.value, 17, 4) || '-' || substr(hash.value, 21, 12))::uuid,
  definitions.provider,
  definitions.code,
  definitions.scope,
  left(definitions.name, 120),
  definitions.description,
  definitions.source_field,
  1,
  definitions.unit,
  definitions.aggregation_strategy,
  definitions.weighting_metric_code,
  true,
  definitions.retention_days,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM definition_values definitions
CROSS JOIN LATERAL (SELECT md5(definitions.provider::text || ':' || definitions.scope::text || ':' || definitions.code) AS value) hash
ON CONFLICT ("provider", "code", "scope", "definitionVersion") DO NOTHING;

WITH account_record_groups AS (
  SELECT
    metric."accountId",
    metric."metricDate",
    metric."scope",
    min(metric."id"::text)::uuid AS record_id,
    min(metric."createdAt") AS created_at,
    max(metric."updatedAt") AS updated_at
  FROM "social_media_dashboard"."AccountDailyMetric" metric
  GROUP BY metric."accountId", metric."metricDate", metric."scope"
)
INSERT INTO "social_media_dashboard"."ConnectedAccountAnalyticsRecord" (
  "id", "connectedAccountId", "sourceObservationKey", "recordDate", "scope",
  "sourceObjectId", "retrievedAt", "createdAt", "updatedAt"
)
SELECT
  groups.record_id,
  groups."accountId",
  'account:' || to_char(groups."metricDate", 'YYYY-MM-DD') || ':' || groups."scope"::text,
  groups."metricDate",
  'ACCOUNT',
  'ACCOUNT',
  groups.updated_at,
  groups.created_at,
  groups.updated_at
FROM account_record_groups groups;

INSERT INTO "social_media_dashboard"."ConnectedAccountAnalyticsRecord" (
  "id", "connectedAccountId", "sourceObservationKey", "recordDate", "scope",
  "sourceObjectId", "objectTitle", "objectType", "objectUrl", "objectOccurredAt",
  "periodFrom", "periodTo", "dataScope", "retrievedAt", "createdAt", "updatedAt"
)
SELECT
  post."id",
  post."accountId",
  'content:' || post."externalPostId" || ':' || to_char(post."periodFrom", 'YYYY-MM-DD') || ':' || to_char(post."periodTo", 'YYYY-MM-DD'),
  post."periodTo",
  'CONTENT',
  post."externalPostId",
  post."title",
  post."postType",
  post."permalink",
  post."publishedAt",
  post."periodFrom",
  post."periodTo",
  post."dataScope"::"social_media_dashboard"."AccountAnalyticsDataScope",
  post."observedAt",
  post."createdAt",
  post."observedAt"
FROM "social_media_dashboard"."AccountPostSnapshot" post;

INSERT INTO "social_media_dashboard"."ConnectedAccountAnalyticsRecord" (
  "id", "connectedAccountId", "sourceObservationKey", "recordDate", "scope",
  "sourceObjectId", "objectTitle", "objectType", "objectOccurredAt", "dataScope",
  "retrievedAt", "createdAt", "updatedAt"
)
SELECT
  campaign."id",
  campaign."accountId",
  'email:' || campaign."externalCampaignId",
  coalesce(campaign."sentAt"::date, campaign."observedAt"::date),
  'EMAIL_CAMPAIGN',
  campaign."externalCampaignId",
  campaign."campaignName",
  'EMAIL CAMPAIGN',
  campaign."sentAt",
  'CUMULATIVE',
  campaign."observedAt",
  campaign."createdAt",
  campaign."updatedAt"
FROM "social_media_dashboard"."EmailCampaignSnapshot" campaign;

INSERT INTO "social_media_dashboard"."ConnectedAccountMetricValue" (
  "id", "recordId", "metricDefinitionId", "value", "sourceDataExpiresAt", "createdAt", "updatedAt"
)
SELECT
  metric."id",
  record."id",
  definition."id",
  metric."value",
  CASE WHEN definition."retentionDays" IS NULL THEN NULL
    ELSE metric."updatedAt" + definition."retentionDays" * INTERVAL '1 day' END,
  metric."createdAt",
  metric."updatedAt"
FROM "social_media_dashboard"."AccountDailyMetric" metric
JOIN "social_media_dashboard"."ConnectedAccount" account ON account."id" = metric."accountId"
JOIN "social_media_dashboard"."ConnectedAccountAnalyticsRecord" record
  ON record."connectedAccountId" = metric."accountId"
  AND record."sourceObservationKey" = 'account:' || to_char(metric."metricDate", 'YYYY-MM-DD') || ':' || metric."scope"::text
JOIN "social_media_dashboard"."IntegrationMetricDefinition" definition
  ON definition."provider" = CASE account."provider"::text
    WHEN 'INSTAGRAM' THEN 'INSTAGRAM_ORGANIC'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'FACEBOOK' THEN 'FACEBOOK_ORGANIC'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'LINKEDIN' THEN 'LINKEDIN_ORGANIC'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'YOUTUBE' THEN 'YOUTUBE_ANALYTICS'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'ZOHO_CAMPAIGNS' THEN 'ZOHO_CAMPAIGNS'::"social_media_dashboard"."IntegrationProvider"
  END
  AND definition."code" = metric."metricCode"
  AND definition."scope" = 'ACCOUNT'
  AND definition."definitionVersion" = 1;

INSERT INTO "social_media_dashboard"."ConnectedAccountMetricValue" (
  "id", "recordId", "metricDefinitionId", "value", "sourceDataExpiresAt", "createdAt", "updatedAt"
)
SELECT
  (substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-' || substr(hash.value, 13, 4) || '-' || substr(hash.value, 17, 4) || '-' || substr(hash.value, 21, 12))::uuid,
  record."id",
  definition."id",
  metric.value::numeric,
  coalesce(post."expiresAt", CASE WHEN definition."retentionDays" IS NULL THEN NULL
    ELSE post."observedAt" + definition."retentionDays" * INTERVAL '1 day' END),
  post."createdAt",
  post."observedAt"
FROM "social_media_dashboard"."AccountPostSnapshot" post
CROSS JOIN LATERAL jsonb_each_text(post."metricValues") metric
CROSS JOIN LATERAL (SELECT md5('post-value:' || post."id"::text || ':' || metric.key) AS value) hash
JOIN "social_media_dashboard"."ConnectedAccountAnalyticsRecord" record
  ON record."connectedAccountId" = post."accountId"
  AND record."sourceObservationKey" = 'content:' || post."externalPostId" || ':' || to_char(post."periodFrom", 'YYYY-MM-DD') || ':' || to_char(post."periodTo", 'YYYY-MM-DD')
JOIN "social_media_dashboard"."ConnectedAccount" account ON account."id" = post."accountId"
JOIN "social_media_dashboard"."IntegrationMetricDefinition" definition
  ON definition."provider" = CASE account."provider"::text
    WHEN 'INSTAGRAM' THEN 'INSTAGRAM_ORGANIC'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'FACEBOOK' THEN 'FACEBOOK_ORGANIC'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'LINKEDIN' THEN 'LINKEDIN_ORGANIC'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'YOUTUBE' THEN 'YOUTUBE_ANALYTICS'::"social_media_dashboard"."IntegrationProvider"
    WHEN 'ZOHO_CAMPAIGNS' THEN 'ZOHO_CAMPAIGNS'::"social_media_dashboard"."IntegrationProvider"
  END
  AND definition."code" = metric.key
  AND definition."scope" = 'CONTENT'
  AND definition."definitionVersion" = 1;

INSERT INTO "social_media_dashboard"."ConnectedAccountMetricValue" (
  "id", "recordId", "metricDefinitionId", "value", "sourceDataExpiresAt", "createdAt", "updatedAt"
)
SELECT
  (substr(hash.value, 1, 8) || '-' || substr(hash.value, 9, 4) || '-' || substr(hash.value, 13, 4) || '-' || substr(hash.value, 17, 4) || '-' || substr(hash.value, 21, 12))::uuid,
  record."id",
  definition."id",
  metric.value::numeric,
  NULL,
  campaign."createdAt",
  campaign."updatedAt"
FROM "social_media_dashboard"."EmailCampaignSnapshot" campaign
CROSS JOIN LATERAL jsonb_each_text(campaign."metricValues") metric
CROSS JOIN LATERAL (SELECT md5('email-value:' || campaign."id"::text || ':' || metric.key) AS value) hash
JOIN "social_media_dashboard"."ConnectedAccountAnalyticsRecord" record
  ON record."connectedAccountId" = campaign."accountId"
  AND record."sourceObservationKey" = 'email:' || campaign."externalCampaignId"
JOIN "social_media_dashboard"."IntegrationMetricDefinition" definition
  ON definition."provider" = 'ZOHO_CAMPAIGNS'
  AND definition."code" = metric.key
  AND definition."scope" = 'EMAIL_CAMPAIGN'
  AND definition."definitionVersion" = 1;

DO $$
DECLARE
  legacy_value_count BIGINT;
  migrated_value_count BIGINT;
BEGIN
  SELECT
    (SELECT count(*) FROM "social_media_dashboard"."AccountDailyMetric")
    + (SELECT count(*) FROM "social_media_dashboard"."AccountPostSnapshot" post CROSS JOIN LATERAL jsonb_each_text(post."metricValues"))
    + (SELECT count(*) FROM "social_media_dashboard"."EmailCampaignSnapshot" campaign CROSS JOIN LATERAL jsonb_each_text(campaign."metricValues"))
  INTO legacy_value_count;
  SELECT count(*) INTO migrated_value_count
  FROM "social_media_dashboard"."ConnectedAccountMetricValue" value
  JOIN "social_media_dashboard"."ConnectedAccountAnalyticsRecord" record ON record."id" = value."recordId"
  WHERE record."connectedAccountId" IS NOT NULL;
  IF legacy_value_count <> migrated_value_count THEN
    RAISE EXCEPTION 'Connected-account analytics migration copied % of % metric values', migrated_value_count, legacy_value_count;
  END IF;
END $$;

DROP TABLE "social_media_dashboard"."EmailCampaignSnapshot";
DROP TABLE "social_media_dashboard"."AccountPostSnapshot";
DROP TABLE "social_media_dashboard"."AccountDailyMetric";
DROP TYPE "social_media_dashboard"."AccountMetricScope";
