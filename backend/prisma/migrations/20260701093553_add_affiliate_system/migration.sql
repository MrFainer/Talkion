-- AlterTable: add referral fields to User
ALTER TABLE "User" ADD COLUMN "referral_code" TEXT;
ALTER TABLE "User" ADD COLUMN "referred_by" TEXT;
CREATE UNIQUE INDEX "User_referral_code_key" ON "User"("referral_code");

-- CreateTable: AffiliateCommission
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referred_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AffiliateCommission_referrer_id_idx" ON "AffiliateCommission"("referrer_id");
CREATE INDEX "AffiliateCommission_status_idx" ON "AffiliateCommission"("status");

ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
