ALTER TABLE "MessageSettings"
ALTER COLUMN "lessons_confirmation_enabled" SET DEFAULT false;

UPDATE "MessageSettings"
SET "lessons_confirmation_enabled" = false
WHERE "lessons_confirmation_enabled" = true;
