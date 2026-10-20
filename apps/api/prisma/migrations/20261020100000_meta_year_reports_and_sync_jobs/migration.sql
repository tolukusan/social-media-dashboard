CREATE TYPE "social_media_dashboard"."ConnectedAccountSyncJobStatus" AS ENUM (
  'QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'
);

CREATE TYPE "social_media_dashboard"."ConnectedAccountSyncJobSource" AS ENUM (
  'MANUAL', 'SCHEDULED', 'OAUTH'
);

CREATE TYPE "social_media_dashboard"."ConnectedAccountSyncChunkStatus" AS ENUM (
  'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'
);

ALTER TABLE "social_media_dashboard"."ConnectedAccount"
  ADD COLUMN "historyBootstrapEnqueuedAt" TIMESTAMP(3);

CREATE TABLE "social_media_dashboard"."ConnectedAccountSyncJob" (
  "id" UUID NOT NULL,
  "connectedAccountId" UUID NOT NULL,
  "requestedFrom" DATE NOT NULL,
  "requestedTo" DATE NOT NULL,
  "fetchFrom" DATE,
  "fetchTo" DATE,
  "source" "social_media_dashboard"."ConnectedAccountSyncJobSource" NOT NULL,
  "status" "social_media_dashboard"."ConnectedAccountSyncJobStatus" NOT NULL DEFAULT 'QUEUED',
  "requestedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "snapshotRecordedAt" TIMESTAMP(3),
  "contentRefreshRecordedAt" TIMESTAMP(3),
  "leaseToken" UUID,
  "leaseUntil" TIMESTAMP(3),
  "finalErrorCode" VARCHAR(60),
  CONSTRAINT "ConnectedAccountSyncJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConnectedAccountSyncJob_date_order" CHECK (
    "requestedFrom" <= "requestedTo" AND
    (("fetchFrom" IS NULL AND "fetchTo" IS NULL) OR
     ("fetchFrom" IS NOT NULL AND "fetchTo" IS NOT NULL AND "fetchFrom" <= "fetchTo"))
  )
);

CREATE TABLE "social_media_dashboard"."ConnectedAccountSyncChunk" (
  "id" UUID NOT NULL,
  "jobId" UUID NOT NULL,
  "fromDate" DATE NOT NULL,
  "toDate" DATE NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "social_media_dashboard"."ConnectedAccountSyncChunkStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observationCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(60),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectedAccountSyncChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConnectedAccountSyncChunk_date_order" CHECK ("fromDate" <= "toDate"),
  CONSTRAINT "ConnectedAccountSyncChunk_sequence_nonnegative" CHECK ("sequence" >= 0),
  CONSTRAINT "ConnectedAccountSyncChunk_attempts_nonnegative" CHECK ("attemptCount" >= 0)
);

CREATE INDEX "ConnectedAccountSyncJob_connectedAccountId_status_createdAt_idx"
  ON "social_media_dashboard"."ConnectedAccountSyncJob"("connectedAccountId", "status", "createdAt");
CREATE INDEX "ConnectedAccountSyncJob_status_leaseUntil_createdAt_idx"
  ON "social_media_dashboard"."ConnectedAccountSyncJob"("status", "leaseUntil", "createdAt");
CREATE INDEX "ConnectedAccountSyncJob_completedAt_idx"
  ON "social_media_dashboard"."ConnectedAccountSyncJob"("completedAt");
CREATE UNIQUE INDEX "ConnectedAccountSyncJob_one_active_per_account"
  ON "social_media_dashboard"."ConnectedAccountSyncJob"("connectedAccountId")
  WHERE "status" IN ('QUEUED', 'RUNNING');
CREATE UNIQUE INDEX "ConnectedAccountSyncChunk_jobId_sequence_key"
  ON "social_media_dashboard"."ConnectedAccountSyncChunk"("jobId", "sequence");
CREATE INDEX "ConnectedAccountSyncChunk_jobId_status_sequence_idx"
  ON "social_media_dashboard"."ConnectedAccountSyncChunk"("jobId", "status", "sequence");
CREATE INDEX "ConnectedAccountSyncChunk_status_nextAttemptAt_idx"
  ON "social_media_dashboard"."ConnectedAccountSyncChunk"("status", "nextAttemptAt");

ALTER TABLE "social_media_dashboard"."ConnectedAccountSyncJob"
  ADD CONSTRAINT "ConnectedAccountSyncJob_connectedAccountId_fkey"
  FOREIGN KEY ("connectedAccountId") REFERENCES "social_media_dashboard"."ConnectedAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."ConnectedAccountSyncJob"
  ADD CONSTRAINT "ConnectedAccountSyncJob_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "social_media_dashboard"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."ConnectedAccountSyncChunk"
  ADD CONSTRAINT "ConnectedAccountSyncChunk_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "social_media_dashboard"."ConnectedAccountSyncJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "social_media_dashboard"."IntegrationMetricDefinition"
SET "retentionDays" = 365, "updatedAt" = CURRENT_TIMESTAMP
WHERE "scope" = 'ACCOUNT'
  AND "retentionDays" = 90
  AND (
    ("provider" = 'INSTAGRAM_ORGANIC' AND "code" IN (
      'AUDIENCE_SIZE', 'MEDIA_VIEWS', 'ACCOUNTS_REACHED', 'CONTENT_INTERACTIONS'
    )) OR
    ("provider" = 'FACEBOOK_ORGANIC' AND "code" IN (
      'AUDIENCE_SIZE', 'PAGE_VISITS', 'ORGANIC_MEDIA_VIEWS'
    ))
  );

UPDATE "social_media_dashboard"."ConnectedAccountMetricValue" AS metric_value
SET "sourceDataExpiresAt" = record."retrievedAt" + INTERVAL '365 days'
FROM "social_media_dashboard"."ConnectedAccountAnalyticsRecord" AS record,
     "social_media_dashboard"."IntegrationMetricDefinition" AS definition
WHERE metric_value."recordId" = record."id"
  AND definition."id" = metric_value."metricDefinitionId"
  AND record."connectedAccountId" IS NOT NULL
  AND metric_value."sourceDataExpiresAt" > CURRENT_TIMESTAMP
  AND definition."scope" = 'ACCOUNT'
  AND definition."retentionDays" = 365
  AND (
    (definition."provider" = 'INSTAGRAM_ORGANIC' AND definition."code" IN (
      'AUDIENCE_SIZE', 'MEDIA_VIEWS', 'ACCOUNTS_REACHED', 'CONTENT_INTERACTIONS'
    )) OR
    (definition."provider" = 'FACEBOOK_ORGANIC' AND definition."code" IN (
      'AUDIENCE_SIZE', 'PAGE_VISITS', 'ORGANIC_MEDIA_VIEWS'
    ))
  );
