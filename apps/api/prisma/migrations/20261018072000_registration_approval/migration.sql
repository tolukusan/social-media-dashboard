-- Fixed reference roles only. Existing role identities and all users are preserved.
INSERT INTO social_media_dashboard."Role" (id,code,name,active,"createdAt","updatedAt") VALUES
(gen_random_uuid(),'ADMIN','Administrator',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'MARKETING_OFFICER','Marketing Officer',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(gen_random_uuid(),'MANAGEMENT','Management',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;
CREATE TYPE social_media_dashboard."AccessRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TABLE social_media_dashboard."RegistrationRequest" (
 id UUID PRIMARY KEY,email VARCHAR(254) NOT NULL UNIQUE,name VARCHAR(120) NOT NULL,"passwordHash" TEXT,
 status social_media_dashboard."AccessRequestStatus" NOT NULL DEFAULT 'PENDING',"reviewedByUserId" UUID,"reviewedAt" TIMESTAMP(3),"approvedUserId" UUID,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE social_media_dashboard."UserInvitation" (
 id UUID PRIMARY KEY,email VARCHAR(254) NOT NULL,"roleId" UUID NOT NULL REFERENCES social_media_dashboard."Role"(id) ON DELETE RESTRICT,
 "invitedByUserId" UUID NOT NULL,"tokenHash" CHAR(64) NOT NULL UNIQUE,"expiresAt" TIMESTAMP(3) NOT NULL,"usedAt" TIMESTAMP(3),"revokedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "UserInvitation_email_expiresAt_idx" ON social_media_dashboard."UserInvitation"(email,"expiresAt");
ALTER TABLE social_media_dashboard."RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_resolution" CHECK ((status = 'PENDING' AND "passwordHash" IS NOT NULL AND "reviewedAt" IS NULL) OR (status <> 'PENDING' AND "passwordHash" IS NULL AND "reviewedAt" IS NOT NULL));
