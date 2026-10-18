ALTER TYPE "social_media_dashboard"."IntegrationProvider" ADD VALUE IF NOT EXISTS 'FACEBOOK_ORGANIC';
ALTER TYPE "social_media_dashboard"."IntegrationProvider" ADD VALUE IF NOT EXISTS 'INSTAGRAM_ORGANIC';
ALTER TYPE "social_media_dashboard"."IntegrationProvider" ADD VALUE IF NOT EXISTS 'LINKEDIN_ORGANIC';
ALTER TYPE "social_media_dashboard"."IntegrationProvider" ADD VALUE IF NOT EXISTS 'YOUTUBE_ANALYTICS';

CREATE TYPE "social_media_dashboard"."AccountAnalyticsScope" AS ENUM ('ACCOUNT', 'CONTENT');

CREATE TABLE "social_media_dashboard"."IntegrationMetricDefinition" (
    "id" UUID NOT NULL,
    "provider" "social_media_dashboard"."IntegrationProvider" NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "scope" "social_media_dashboard"."AccountAnalyticsScope" NOT NULL DEFAULT 'ACCOUNT',
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "sourceField" VARCHAR(120) NOT NULL,
    "definitionVersion" INTEGER NOT NULL DEFAULT 1,
    "unit" "social_media_dashboard"."MetricUnit" NOT NULL,
    "aggregationStrategy" "social_media_dashboard"."AggregationStrategy" NOT NULL,
    "weightingMetricCode" VARCHAR(80),
    "nonNegative" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationMetricDefinition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntegrationMetricDefinition_version_positive" CHECK ("definitionVersion" > 0),
    CONSTRAINT "IntegrationMetricDefinition_weighting_rule" CHECK (("aggregationStrategy" = 'WEIGHTED_AVERAGE') = ("weightingMetricCode" IS NOT NULL)),
    CONSTRAINT "IntegrationMetricDefinition_retention_days" CHECK ("retentionDays" IS NULL OR "retentionDays" BETWEEN 1 AND 3650)
);

CREATE TABLE "social_media_dashboard"."ConnectedAccountAnalyticsRecord" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "recordDate" DATE NOT NULL,
    "scope" "social_media_dashboard"."AccountAnalyticsScope" NOT NULL DEFAULT 'ACCOUNT',
    "sourceObjectId" VARCHAR(160) NOT NULL DEFAULT 'ACCOUNT',
    "sourceApiVersion" VARCHAR(40),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConnectedAccountAnalyticsRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConnectedAccountAnalyticsRecord_scope_identity" CHECK (("scope" = 'ACCOUNT' AND "sourceObjectId" = 'ACCOUNT') OR ("scope" = 'CONTENT' AND length("sourceObjectId") > 0 AND "sourceObjectId" <> 'ACCOUNT'))
);

CREATE TABLE "social_media_dashboard"."ConnectedAccountMetricValue" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "metricDefinitionId" UUID NOT NULL,
    "value" DECIMAL(24,6) NOT NULL,
    "sourceDataExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConnectedAccountMetricValue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "social_media_dashboard"."PerformanceMetricValue"
  ADD COLUMN "sourceConnectionId" UUID,
  ADD COLUMN "sourceDataExpiresAt" TIMESTAMP(3);

UPDATE "social_media_dashboard"."PerformanceMetricValue" AS value
SET "sourceConnectionId" = connection."id",
    "sourceDataExpiresAt" = CASE
      WHEN connection."provider" = 'LINKEDIN_ADS'
        THEN value."createdAt" + INTERVAL '364 days'
      ELSE NULL
    END
FROM "social_media_dashboard"."PerformanceRecord" AS record
JOIN "social_media_dashboard"."IntegrationMapping" AS mapping
  ON mapping."id" = record."integrationMappingId"
JOIN "social_media_dashboard"."IntegrationConnection" AS connection
  ON connection."id" = mapping."connectionId"
WHERE value."performanceRecordId" = record."id"
  AND record."integrationManaged" = true;

CREATE UNIQUE INDEX "IntegrationMetricDefinition_provider_code_scope_definitionVersion_key"
  ON "social_media_dashboard"."IntegrationMetricDefinition"("provider", "code", "scope", "definitionVersion");
CREATE INDEX "IntegrationMetricDefinition_provider_scope_active_idx"
  ON "social_media_dashboard"."IntegrationMetricDefinition"("provider", "scope", "active");
CREATE UNIQUE INDEX "ConnectedAccountAnalyticsRecord_connectionId_recordDate_scope_sourceObjectId_key"
  ON "social_media_dashboard"."ConnectedAccountAnalyticsRecord"("connectionId", "recordDate", "scope", "sourceObjectId");
CREATE INDEX "ConnectedAccountAnalyticsRecord_connectionId_recordDate_idx"
  ON "social_media_dashboard"."ConnectedAccountAnalyticsRecord"("connectionId", "recordDate");
CREATE UNIQUE INDEX "ConnectedAccountMetricValue_recordId_metricDefinitionId_key"
  ON "social_media_dashboard"."ConnectedAccountMetricValue"("recordId", "metricDefinitionId");
CREATE INDEX "ConnectedAccountMetricValue_sourceDataExpiresAt_idx"
  ON "social_media_dashboard"."ConnectedAccountMetricValue"("sourceDataExpiresAt");
CREATE INDEX "PerformanceMetricValue_sourceConnectionId_sourceDataExpiresAt_idx"
  ON "social_media_dashboard"."PerformanceMetricValue"("sourceConnectionId", "sourceDataExpiresAt");

ALTER TABLE "social_media_dashboard"."ConnectedAccountAnalyticsRecord"
  ADD CONSTRAINT "ConnectedAccountAnalyticsRecord_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "social_media_dashboard"."IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."ConnectedAccountMetricValue"
  ADD CONSTRAINT "ConnectedAccountMetricValue_recordId_fkey"
  FOREIGN KEY ("recordId") REFERENCES "social_media_dashboard"."ConnectedAccountAnalyticsRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ConnectedAccountMetricValue_metricDefinitionId_fkey"
  FOREIGN KEY ("metricDefinitionId") REFERENCES "social_media_dashboard"."IntegrationMetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."PerformanceMetricValue"
  ADD CONSTRAINT "PerformanceMetricValue_sourceConnectionId_fkey"
  FOREIGN KEY ("sourceConnectionId") REFERENCES "social_media_dashboard"."IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
