CREATE TYPE "social_media_dashboard"."ConnectedAccountProvider" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'YOUTUBE', 'ZOHO_CAMPAIGNS');
CREATE TYPE "social_media_dashboard"."ConnectedAccountKind" AS ENUM ('SOCIAL', 'EMAIL');
CREATE TYPE "social_media_dashboard"."AccountMetricScope" AS ENUM ('DAILY', 'SNAPSHOT');

CREATE TABLE "social_media_dashboard"."AccountOAuthState" (
  "id" UUID NOT NULL,
  "provider" "social_media_dashboard"."ConnectedAccountProvider" NOT NULL,
  "stateHash" CHAR(64) NOT NULL,
  "userId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_media_dashboard"."ConnectedAccount" (
  "id" UUID NOT NULL,
  "provider" "social_media_dashboard"."ConnectedAccountProvider" NOT NULL,
  "kind" "social_media_dashboard"."ConnectedAccountKind" NOT NULL,
  "externalAccountId" VARCHAR(180) NOT NULL,
  "displayName" VARCHAR(160) NOT NULL,
  "handle" VARCHAR(160),
  "profileUrl" VARCHAR(500),
  "profileMetadataExpiresAt" TIMESTAMP(3),
  "credentialCiphertext" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "connectedByUserId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncErrorCode" VARCHAR(60),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConnectedAccount_kind_provider" CHECK (
    ("kind" = 'EMAIL' AND "provider" = 'ZOHO_CAMPAIGNS') OR
    ("kind" = 'SOCIAL' AND "provider" <> 'ZOHO_CAMPAIGNS')
  )
);

CREATE TABLE "social_media_dashboard"."AccountDailyMetric" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "metricCode" VARCHAR(64) NOT NULL,
  "sourceMetric" VARCHAR(100) NOT NULL,
  "metricDate" DATE NOT NULL,
  "scope" "social_media_dashboard"."AccountMetricScope" NOT NULL DEFAULT 'DAILY',
  "value" DECIMAL(24,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountDailyMetric_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDailyMetric_nonnegative" CHECK ("value" >= 0)
);

CREATE TABLE "social_media_dashboard"."AccountPostSnapshot" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "externalPostId" VARCHAR(180) NOT NULL,
  "title" VARCHAR(500),
  "postType" VARCHAR(80),
  "permalink" VARCHAR(1000),
  "publishedAt" TIMESTAMP(3),
  "periodFrom" DATE NOT NULL,
  "periodTo" DATE NOT NULL,
  "dataScope" VARCHAR(20) NOT NULL DEFAULT 'LIFETIME',
  "metricValues" JSONB NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountPostSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountPostSnapshot_period" CHECK ("periodFrom" <= "periodTo"),
  CONSTRAINT "AccountPostSnapshot_scope" CHECK ("dataScope" IN ('LIFETIME', 'DATE_RANGE'))
);

CREATE TABLE "social_media_dashboard"."EmailCampaignSnapshot" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "externalCampaignId" VARCHAR(180) NOT NULL,
  "campaignName" VARCHAR(300) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metricValues" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaignSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountOAuthState_stateHash_key" ON "social_media_dashboard"."AccountOAuthState"("stateHash");
CREATE INDEX "AccountOAuthState_expiresAt_consumedAt_idx" ON "social_media_dashboard"."AccountOAuthState"("expiresAt", "consumedAt");
CREATE UNIQUE INDEX "ConnectedAccount_provider_externalAccountId_key" ON "social_media_dashboard"."ConnectedAccount"("provider", "externalAccountId");
CREATE INDEX "ConnectedAccount_kind_active_provider_idx" ON "social_media_dashboard"."ConnectedAccount"("kind", "active", "provider");
CREATE UNIQUE INDEX "AccountDailyMetric_accountId_metricCode_metricDate_scope_key" ON "social_media_dashboard"."AccountDailyMetric"("accountId", "metricCode", "metricDate", "scope");
CREATE INDEX "AccountDailyMetric_accountId_metricDate_idx" ON "social_media_dashboard"."AccountDailyMetric"("accountId", "metricDate");
CREATE UNIQUE INDEX "AccountPostSnapshot_accountId_externalPostId_periodFrom_periodTo_key" ON "social_media_dashboard"."AccountPostSnapshot"("accountId", "externalPostId", "periodFrom", "periodTo");
CREATE INDEX "AccountPostSnapshot_accountId_publishedAt_idx" ON "social_media_dashboard"."AccountPostSnapshot"("accountId", "publishedAt");
CREATE INDEX "AccountPostSnapshot_expiresAt_idx" ON "social_media_dashboard"."AccountPostSnapshot"("expiresAt");
CREATE UNIQUE INDEX "EmailCampaignSnapshot_accountId_externalCampaignId_key" ON "social_media_dashboard"."EmailCampaignSnapshot"("accountId", "externalCampaignId");
CREATE INDEX "EmailCampaignSnapshot_accountId_sentAt_idx" ON "social_media_dashboard"."EmailCampaignSnapshot"("accountId", "sentAt");

ALTER TABLE "social_media_dashboard"."AccountOAuthState" ADD CONSTRAINT "AccountOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "social_media_dashboard"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "social_media_dashboard"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."AccountDailyMetric" ADD CONSTRAINT "AccountDailyMetric_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "social_media_dashboard"."ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."AccountPostSnapshot" ADD CONSTRAINT "AccountPostSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "social_media_dashboard"."ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."EmailCampaignSnapshot" ADD CONSTRAINT "EmailCampaignSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "social_media_dashboard"."ConnectedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
