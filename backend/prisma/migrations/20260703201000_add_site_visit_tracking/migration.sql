CREATE TYPE "SiteVisitPageType" AS ENUM ('HOME', 'LOGIN', 'REGISTER');

CREATE TYPE "SiteVisitSourceType" AS ENUM ('DIRECT', 'REFERRAL_LINK');

CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL,
    "page_type" "SiteVisitPageType" NOT NULL,
    "source_type" "SiteVisitSourceType" NOT NULL DEFAULT 'DIRECT',
    "path" TEXT NOT NULL,
    "full_url" TEXT,
    "referral_code" TEXT,
    "referrer_url" TEXT,
    "referer_header" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "browser_name" TEXT,
    "os_name" TEXT,
    "device_type" TEXT,
    "device_vendor" TEXT,
    "device_model" TEXT,
    "platform" TEXT,
    "language" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER,
    "timezone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteVisit_created_at_idx" ON "SiteVisit"("created_at");
CREATE INDEX "SiteVisit_page_type_idx" ON "SiteVisit"("page_type");
CREATE INDEX "SiteVisit_source_type_idx" ON "SiteVisit"("source_type");
CREATE INDEX "SiteVisit_referral_code_idx" ON "SiteVisit"("referral_code");
