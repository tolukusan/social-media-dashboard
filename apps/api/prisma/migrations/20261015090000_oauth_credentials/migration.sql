CREATE TYPE "social_media_dashboard"."IntegrationOAuthCredentialStatus" AS ENUM (
  'CONNECTED',
  'REAUTH_REQUIRED'
);

CREATE TYPE "social_media_dashboard"."IntegrationOAuthAttemptStatus" AS ENUM (
  'PENDING',
  'SUCCEEDED',
  'DENIED',
  'FAILED',
  'EXPIRED'
);

CREATE TYPE "social_media_dashboard"."IntegrationCredentialMode" AS ENUM (
  'SERVER_ENVIRONMENT',
  'OAUTH'
);

ALTER TABLE "social_media_dashboard"."IntegrationConnection"
  ADD COLUMN "credentialMode" "social_media_dashboard"."IntegrationCredentialMode" NOT NULL DEFAULT 'SERVER_ENVIRONMENT',
  ADD COLUMN "oauthGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "IntegrationConnection_oauth_generation" CHECK ("oauthGeneration" >= 0);

CREATE TABLE "social_media_dashboard"."IntegrationOAuthCredential" (
  "id" UUID NOT NULL,
  "connectionId" UUID NOT NULL,
  "encryptedTokenBundle" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "grantedScopes" VARCHAR(2000) NOT NULL DEFAULT '',
  "status" "social_media_dashboard"."IntegrationOAuthCredentialStatus" NOT NULL DEFAULT 'CONNECTED',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRefreshedAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(60),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationOAuthCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationOAuthCredential_payload_nonempty" CHECK (length("encryptedTokenBundle") > 0),
  CONSTRAINT "IntegrationOAuthCredential_scopes_length" CHECK (length("grantedScopes") <= 2000)
);

CREATE TABLE "social_media_dashboard"."IntegrationOAuthAttempt" (
  "id" UUID NOT NULL,
  "connectionId" UUID NOT NULL,
  "requestedByUserId" UUID NOT NULL,
  "provider" "social_media_dashboard"."IntegrationProvider" NOT NULL,
  "oauthGeneration" INTEGER NOT NULL,
  "stateHash" VARCHAR(64) NOT NULL,
  "encryptedPkceVerifier" TEXT,
  "status" "social_media_dashboard"."IntegrationOAuthAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationOAuthAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationOAuthAttempt_state_hash" CHECK ("stateHash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "IntegrationOAuthAttempt_generation" CHECK ("oauthGeneration" >= 0),
  CONSTRAINT "IntegrationOAuthAttempt_consumption" CHECK (("status" = 'PENDING') = ("consumedAt" IS NULL))
);

CREATE UNIQUE INDEX "IntegrationOAuthCredential_connectionId_key"
  ON "social_media_dashboard"."IntegrationOAuthCredential"("connectionId");
CREATE INDEX "IntegrationOAuthCredential_status_tokenExpiresAt_idx"
  ON "social_media_dashboard"."IntegrationOAuthCredential"("status", "tokenExpiresAt");
CREATE UNIQUE INDEX "IntegrationOAuthAttempt_stateHash_key"
  ON "social_media_dashboard"."IntegrationOAuthAttempt"("stateHash");
CREATE INDEX "IntegrationOAuthAttempt_connectionId_createdAt_idx"
  ON "social_media_dashboard"."IntegrationOAuthAttempt"("connectionId", "createdAt");
CREATE INDEX "IntegrationOAuthAttempt_status_expiresAt_idx"
  ON "social_media_dashboard"."IntegrationOAuthAttempt"("status", "expiresAt");
CREATE INDEX "IntegrationOAuthAttempt_requestedByUserId_createdAt_idx"
  ON "social_media_dashboard"."IntegrationOAuthAttempt"("requestedByUserId", "createdAt");

ALTER TABLE "social_media_dashboard"."IntegrationOAuthCredential"
  ADD CONSTRAINT "IntegrationOAuthCredential_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "social_media_dashboard"."IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "social_media_dashboard"."IntegrationOAuthAttempt"
  ADD CONSTRAINT "IntegrationOAuthAttempt_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "social_media_dashboard"."IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "IntegrationOAuthAttempt_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "social_media_dashboard"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
