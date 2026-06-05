-- AlterTable
ALTER TABLE "MessageSettings" ADD COLUMN     "admin_news_capture_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MessageSettings" ADD COLUMN     "admin_quiz_generation_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MessageSettings" ADD COLUMN     "admin_auto_send_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MessageSettings" ADD COLUMN     "admin_group_send_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MessageSettings" ADD COLUMN     "admin_lessons_confirmation_enabled" BOOLEAN NOT NULL DEFAULT true;
