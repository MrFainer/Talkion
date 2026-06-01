-- Create CreditActionConfig table
CREATE TABLE IF NOT EXISTS "CreditActionConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'content',
    "default_cost" INTEGER NOT NULL DEFAULT 5,
    "current_cost" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditActionConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditActionConfig_key_key" ON "CreditActionConfig"("key");

-- Create CreditTransaction table
CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DEBIT',
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "action_key" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditTransaction_user_id_created_at_idx" ON "CreditTransaction"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "CreditTransaction_user_id_type_idx" ON "CreditTransaction"("user_id", "type");

-- Add max_students to SubscriptionPlan
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "max_students" INTEGER NOT NULL DEFAULT 50;

-- Add columns to Subscription
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "additional_students" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "max_students" INTEGER NOT NULL DEFAULT 50;
