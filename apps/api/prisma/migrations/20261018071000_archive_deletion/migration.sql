CREATE TABLE social_media_dashboard."ArchiveDeletionConfirmation" (
 id UUID PRIMARY KEY, "tokenHash" CHAR(64) NOT NULL UNIQUE, "actorUserId" UUID NOT NULL,
 "entityKind" VARCHAR(20) NOT NULL, "entityId" UUID NOT NULL, fingerprint CHAR(64) NOT NULL,
 "typedText" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ArchiveDeletionConfirmation_expiresAt_idx" ON social_media_dashboard."ArchiveDeletionConfirmation"("expiresAt");
-- Deliberately no entity FK: deletion evidence must survive removal of the entity.
CREATE TABLE social_media_dashboard."DeletedPerformanceKey" (
 id UUID PRIMARY KEY, "campaignPlatformId" UUID NOT NULL, "recordDate" DATE NOT NULL,
 "deletedRecordId" UUID NOT NULL, "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("campaignPlatformId", "recordDate")
);
