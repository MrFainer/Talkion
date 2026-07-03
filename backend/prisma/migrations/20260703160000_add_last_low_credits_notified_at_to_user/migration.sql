ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "last_low_credits_notified_at" TIMESTAMP(3);
