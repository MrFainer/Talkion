-- AlterTable
ALTER TABLE "MessageSettings" ALTER COLUMN "weekly_summary_enabled" SET DEFAULT false;

-- Update existing records to match new default
UPDATE "MessageSettings" SET "weekly_summary_enabled" = false WHERE "weekly_summary_enabled" IS NOT NULL;
