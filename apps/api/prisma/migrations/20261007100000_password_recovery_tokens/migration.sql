CREATE TABLE "social_media_dashboard"."PasswordRecoveryToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emailAtIssue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "PasswordRecoveryToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordRecoveryToken_expiry_after_creation_check" CHECK ("expiresAt" > "createdAt")
);

CREATE UNIQUE INDEX "PasswordRecoveryToken_tokenHash_key" ON "social_media_dashboard"."PasswordRecoveryToken"("tokenHash");
CREATE INDEX "PasswordRecoveryToken_userId_usedAt_revokedAt_expiresAt_idx" ON "social_media_dashboard"."PasswordRecoveryToken"("userId", "usedAt", "revokedAt", "expiresAt");

ALTER TABLE "social_media_dashboard"."PasswordRecoveryToken"
ADD CONSTRAINT "PasswordRecoveryToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "social_media_dashboard"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
