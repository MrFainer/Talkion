-- AlterTable
ALTER TABLE "MessageSettings" ADD COLUMN     "auto_send_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "automation_days" JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
ADD COLUMN     "news_capture_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "quiz_generation_enabled" BOOLEAN NOT NULL DEFAULT true;
