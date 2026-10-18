CREATE TYPE "social_media_dashboard"."DatasetManagementCapability" AS ENUM (
  'MANAGEABLE',
  'HISTORICAL_PROTECTED'
);

CREATE TYPE "social_media_dashboard"."DatasetImportOperation" AS ENUM (
  'CREATE',
  'REPLACE'
);

ALTER TABLE "social_media_dashboard"."ImportBatch"
  ADD COLUMN "datasetCampaignId" UUID,
  ADD COLUMN "datasetOperation" "social_media_dashboard"."DatasetImportOperation",
  ADD COLUMN "targetDatasetId" UUID,
  ADD COLUMN "expectedDatasetVersion" INTEGER,
  ADD COLUMN "datasetAttemptStartedAt" TIMESTAMP(3),
  ADD COLUMN "datasetAttemptInvalidatedAt" TIMESTAMP(3);

ALTER TABLE "social_media_dashboard"."ImportRow"
  ADD COLUMN "rawCells" JSONB;

CREATE TABLE "social_media_dashboard"."Dataset" (
  "id" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "name" VARCHAR(240) NOT NULL,
  "sourceFilename" VARCHAR(500) NOT NULL,
  "sourceChecksum" CHAR(64) NOT NULL,
  "worksheetKey" VARCHAR(255) NOT NULL,
  "worksheetName" VARCHAR(255),
  "currentRevision" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "managementCapability" "social_media_dashboard"."DatasetManagementCapability" NOT NULL DEFAULT 'MANAGEABLE',
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Dataset_campaignId_fkey" FOREIGN KEY ("campaignId")
    REFERENCES "social_media_dashboard"."Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Dataset_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES "social_media_dashboard"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "social_media_dashboard"."DatasetRevision" (
  "id" UUID NOT NULL,
  "datasetId" UUID NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "importBatchId" UUID NOT NULL,
  "sourceFilename" VARCHAR(500) NOT NULL,
  "sourceChecksum" CHAR(64) NOT NULL,
  "worksheetKey" VARCHAR(255) NOT NULL,
  "worksheetName" VARCHAR(255),
  "headerFingerprint" CHAR(64) NOT NULL,
  "columns" JSONB NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatasetRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DatasetRevision_datasetId_fkey" FOREIGN KEY ("datasetId")
    REFERENCES "social_media_dashboard"."Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DatasetRevision_importBatchId_fkey" FOREIGN KEY ("importBatchId")
    REFERENCES "social_media_dashboard"."ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DatasetRevision_rowCount_check" CHECK ("rowCount" > 0)
);

CREATE TABLE "social_media_dashboard"."DatasetRow" (
  "id" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "sourceRowNumber" INTEGER NOT NULL,
  "cells" JSONB NOT NULL,
  "typedCells" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatasetRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DatasetRow_revisionId_fkey" FOREIGN KEY ("revisionId")
    REFERENCES "social_media_dashboard"."DatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DatasetRow_sourceRowNumber_check" CHECK ("sourceRowNumber" > 0)
);

CREATE TABLE "social_media_dashboard"."DatasetImportTemplate" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "headerFingerprint" CHAR(64) NOT NULL,
  "rules" JSONB NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DatasetImportTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DatasetImportTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES "social_media_dashboard"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "social_media_dashboard"."DatasetDeletionFence" (
  "id" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "sourceChecksum" CHAR(64) NOT NULL,
  "worksheetKey" VARCHAR(255) NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatasetDeletionFence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dataset_campaignId_sourceChecksum_worksheetKey_key"
  ON "social_media_dashboard"."Dataset"("campaignId", "sourceChecksum", "worksheetKey");
CREATE INDEX "Dataset_campaignId_createdAt_id_idx"
  ON "social_media_dashboard"."Dataset"("campaignId", "createdAt", "id");
CREATE UNIQUE INDEX "DatasetRevision_importBatchId_key"
  ON "social_media_dashboard"."DatasetRevision"("importBatchId");
CREATE UNIQUE INDEX "DatasetRevision_datasetId_revisionNumber_key"
  ON "social_media_dashboard"."DatasetRevision"("datasetId", "revisionNumber");
CREATE INDEX "DatasetRevision_datasetId_createdAt_idx"
  ON "social_media_dashboard"."DatasetRevision"("datasetId", "createdAt");
CREATE UNIQUE INDEX "DatasetRow_revisionId_sourceRowNumber_key"
  ON "social_media_dashboard"."DatasetRow"("revisionId", "sourceRowNumber");
CREATE UNIQUE INDEX "DatasetImportTemplate_createdByUserId_name_key"
  ON "social_media_dashboard"."DatasetImportTemplate"("createdByUserId", "name");
CREATE INDEX "DatasetImportTemplate_createdByUserId_headerFingerprint_idx"
  ON "social_media_dashboard"."DatasetImportTemplate"("createdByUserId", "headerFingerprint");
CREATE UNIQUE INDEX "DatasetDeletionFence_campaignId_sourceChecksum_worksheetKey_key"
  ON "social_media_dashboard"."DatasetDeletionFence"("campaignId", "sourceChecksum", "worksheetKey");
CREATE INDEX "DatasetDeletionFence_deletedAt_idx"
  ON "social_media_dashboard"."DatasetDeletionFence"("deletedAt");
CREATE INDEX "ImportBatch_datasetCampaignId_checksum_selectedSheet_idx"
  ON "social_media_dashboard"."ImportBatch"("datasetCampaignId", "checksum", "selectedSheet");
