ALTER TABLE "MessageSettings"
ADD COLUMN IF NOT EXISTS "auto_group_targets" JSONB;

UPDATE "MessageSettings"
SET "auto_group_targets" = '[]'::jsonb
WHERE "auto_group_targets" IS NULL;

ALTER TABLE "MessageSettings"
ALTER COLUMN "auto_group_targets" SET DEFAULT '[]'::jsonb;

ALTER TABLE "MessageSettings"
ALTER COLUMN "auto_group_targets" SET NOT NULL;

