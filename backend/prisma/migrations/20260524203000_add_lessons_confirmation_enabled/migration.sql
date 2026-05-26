ALTER TABLE "MessageSettings"
ADD COLUMN IF NOT EXISTS "lessons_confirmation_enabled" BOOLEAN;

UPDATE "MessageSettings"
SET "lessons_confirmation_enabled" = true
WHERE "lessons_confirmation_enabled" IS NULL;

ALTER TABLE "MessageSettings"
ALTER COLUMN "lessons_confirmation_enabled" SET DEFAULT true;

ALTER TABLE "MessageSettings"
ALTER COLUMN "lessons_confirmation_enabled" SET NOT NULL;

