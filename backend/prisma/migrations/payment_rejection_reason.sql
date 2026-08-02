ALTER TABLE "SubscriptionPayment"
  ADD COLUMN IF NOT EXISTS "status_detail" TEXT,
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;