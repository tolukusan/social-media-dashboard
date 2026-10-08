CREATE TABLE "social_media_dashboard"."ReportingSettings" (
    "id" TEXT NOT NULL DEFAULT 'organisation',
    "reportingCurrency" VARCHAR(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportingSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReportingSettings_singleton" CHECK ("id" = 'organisation'),
    CONSTRAINT "ReportingSettings_currency_format" CHECK (
      "reportingCurrency" IS NULL OR "reportingCurrency" ~ '^[A-Z]{3}$'
    )
);
