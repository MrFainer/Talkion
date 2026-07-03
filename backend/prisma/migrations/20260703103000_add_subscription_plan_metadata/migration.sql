ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "max_teachers" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "is_free" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "SubscriptionPlan"
ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

UPDATE "SubscriptionPlan"
SET "max_teachers" = COALESCE("max_teachers", 1)
WHERE "max_teachers" IS NULL;

UPDATE "SubscriptionPlan"
SET "is_free" = COALESCE("is_free", false)
WHERE "is_free" IS NULL;

UPDATE "SubscriptionPlan"
SET "features" = COALESCE("features", '{}'::jsonb)
WHERE "features" IS NULL;

UPDATE "SubscriptionPlan"
SET "sort_order" = COALESCE("sort_order", 0)
WHERE "sort_order" IS NULL;
