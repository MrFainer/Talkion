-- AlterTable
ALTER TABLE "LessonConfirmation" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'DAILY_MESSAGE';

-- AlterTable
ALTER TABLE "MessageSettings" ADD COLUMN     "admin_quick_tip_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quick_tip_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quick_tip_time" VARCHAR(5) NOT NULL DEFAULT '12:00';
