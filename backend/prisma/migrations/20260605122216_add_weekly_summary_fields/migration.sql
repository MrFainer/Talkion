-- AlterTable
ALTER TABLE "MessageSettings" ADD COLUMN     "admin_weekly_summary_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weekly_summary_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekly_summary_time" VARCHAR(5) NOT NULL DEFAULT '08:00';
