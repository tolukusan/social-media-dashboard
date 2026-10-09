-- CreateEnum
CREATE TYPE "social_media_dashboard"."IntegrationProvider" AS ENUM ('FACEBOOK_ADS', 'INSTAGRAM_ADS', 'LINKEDIN_ADS', 'ZOHO_CAMPAIGNS');

-- CreateEnum
CREATE TYPE "social_media_dashboard"."IntegrationRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'BLOCKED');

-- AlterTable
ALTER TABLE "social_media_dashboard"."PerformanceRecord" ADD COLUMN     "integrationManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "integrationMappingId" UUID;

-- CreateTable
CREATE TABLE "social_media_dashboard"."IntegrationConnection" (
    "id" UUID NOT NULL,
    "provider" "social_media_dashboard"."IntegrationProvider" NOT NULL,
    "platformId" UUID NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "externalAccountId" VARCHAR(160) NOT NULL,
    "credentialReference" VARCHAR(100) NOT NULL,
    "sourceTimezone" VARCHAR(100) NOT NULL,
    "currency" VARCHAR(3),
    "region" VARCHAR(10) NOT NULL DEFAULT 'US',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "configuredByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_dashboard"."IntegrationMapping" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "campaignPlatformId" UUID NOT NULL,
    "externalCampaignId" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_media_dashboard"."IntegrationRun" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "status" "social_media_dashboard"."IntegrationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "triggeredBy" VARCHAR(20) NOT NULL,
    "createdRecords" INTEGER NOT NULL DEFAULT 0,
    "updatedRecords" INTEGER NOT NULL DEFAULT 0,
    "unchangedRecords" INTEGER NOT NULL DEFAULT 0,
    "conflicts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(60),
    "summary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationConnection_active_autoSync_nextSyncAt_idx" ON "social_media_dashboard"."IntegrationConnection"("active", "autoSync", "nextSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_provider_region_externalAccountId_key" ON "social_media_dashboard"."IntegrationConnection"("provider", "region", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationMapping_campaignPlatformId_key" ON "social_media_dashboard"."IntegrationMapping"("campaignPlatformId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationMapping_connectionId_externalCampaignId_key" ON "social_media_dashboard"."IntegrationMapping"("connectionId", "externalCampaignId");

-- CreateIndex
CREATE INDEX "IntegrationRun_connectionId_startedAt_idx" ON "social_media_dashboard"."IntegrationRun"("connectionId", "startedAt");

-- CreateIndex
CREATE INDEX "PerformanceRecord_integrationMappingId_idx" ON "social_media_dashboard"."PerformanceRecord"("integrationMappingId");

-- AddForeignKey
ALTER TABLE "social_media_dashboard"."PerformanceRecord" ADD CONSTRAINT "PerformanceRecord_integrationMappingId_fkey" FOREIGN KEY ("integrationMappingId") REFERENCES "social_media_dashboard"."IntegrationMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_dashboard"."IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "social_media_dashboard"."Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_dashboard"."IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_configuredByUserId_fkey" FOREIGN KEY ("configuredByUserId") REFERENCES "social_media_dashboard"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_dashboard"."IntegrationMapping" ADD CONSTRAINT "IntegrationMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "social_media_dashboard"."IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_dashboard"."IntegrationMapping" ADD CONSTRAINT "IntegrationMapping_campaignPlatformId_fkey" FOREIGN KEY ("campaignPlatformId") REFERENCES "social_media_dashboard"."CampaignPlatform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_media_dashboard"."IntegrationRun" ADD CONSTRAINT "IntegrationRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "social_media_dashboard"."IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additional integrity constraints; existing analytical rows keep their default unmanaged state.
ALTER TABLE "social_media_dashboard"."PerformanceRecord"
  ADD CONSTRAINT "PerformanceRecord_integration_owner" CHECK (NOT "integrationManaged" OR "integrationMappingId" IS NOT NULL);
ALTER TABLE "social_media_dashboard"."IntegrationConnection"
  ADD CONSTRAINT "IntegrationConnection_credential_reference" CHECK ("credentialReference" ~ '^INTEGRATION_[A-Z0-9_]+_ACCESS_TOKEN$'),
  ADD CONSTRAINT "IntegrationConnection_currency_format" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "IntegrationConnection_lease_pair" CHECK (("leaseToken" IS NULL) = ("leaseUntil" IS NULL)),
  ADD CONSTRAINT "IntegrationConnection_region" CHECK ("region" IN ('US', 'EU', 'IN', 'AU', 'JP', 'CN'));
ALTER TABLE "social_media_dashboard"."IntegrationRun"
  ADD CONSTRAINT "IntegrationRun_date_range" CHECK ("fromDate" <= "toDate"),
  ADD CONSTRAINT "IntegrationRun_trigger" CHECK ("triggeredBy" IN ('MANUAL', 'SCHEDULED')),
  ADD CONSTRAINT "IntegrationRun_nonnegative_counts" CHECK ("createdRecords" >= 0 AND "updatedRecords" >= 0 AND "unchangedRecords" >= 0 AND "conflicts" >= 0);
