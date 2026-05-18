-- AlterEnum
BEGIN;
CREATE TYPE "CostAction_new" AS ENUM ('NEWS_FALLBACK_GENERATION', 'QUIZ_GENERATION', 'SPEAKING_TRANSCRIPTION', 'SPEAKING_EVALUATION');
ALTER TABLE "UsageCostEvent" ALTER COLUMN "action" TYPE "CostAction_new" USING ("action"::text::"CostAction_new");
ALTER TYPE "CostAction" RENAME TO "CostAction_old";
ALTER TYPE "CostAction_new" RENAME TO "CostAction";
DROP TYPE "public"."CostAction_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CostProvider_new" AS ENUM ('OPENAI');
ALTER TABLE "UsageCostEvent" ALTER COLUMN "provider" TYPE "CostProvider_new" USING ("provider"::text::"CostProvider_new");
ALTER TYPE "CostProvider" RENAME TO "CostProvider_old";
ALTER TYPE "CostProvider_new" RENAME TO "CostProvider";
DROP TYPE "public"."CostProvider_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AudioSubmission" DROP CONSTRAINT "AudioSubmission_student_id_fkey";

-- DropForeignKey
ALTER TABLE "QuizAnswer" DROP CONSTRAINT "QuizAnswer_student_id_fkey";

-- DropForeignKey
ALTER TABLE "SpeakingFeedback" DROP CONSTRAINT "SpeakingFeedback_audio_submission_id_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_user_id_fkey";

-- DropForeignKey
ALTER TABLE "WhatsappMessage" DROP CONSTRAINT "WhatsappMessage_student_id_fkey";

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "teacher_id" TEXT;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "teacher_id" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "receive_private_news" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_valid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UsageCostEvent" ADD COLUMN     "total_tokens" INTEGER,
ALTER COLUMN "audio_seconds" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "news_group_title" TEXT,
ADD COLUMN     "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT,
ADD COLUMN     "verification_token" TEXT,
ADD COLUMN     "whatsapp_instance_name" TEXT;

-- CreateTable
CREATE TABLE "MessageSettings" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "private_greeting_message" TEXT NOT NULL DEFAULT 'Good morning! ☀️🌴🎉',
    "speaking_intro_message" TEXT NOT NULL DEFAULT '*Welcome to the challenge of the day 👊🏻🚀*

Can you read this news out loud and send an audio here?

Você pode ler esta notícia em voz alta e enviar um áudio aqui?

*Have a wonderful day and let’s speak English with Talkion 😉👍🏻🗣️🇺🇸🇬🇧*',
    "news_intro_message" TEXT NOT NULL DEFAULT '📰 *Let’s go to today’s news!*

📰 *Vamos para a notícia do dia!*',
    "private_delay_seconds" INTEGER NOT NULL DEFAULT 2,
    "private_simulate_typing" BOOLEAN NOT NULL DEFAULT true,
    "group_greeting_message" TEXT NOT NULL DEFAULT 'Good morning! 🎉🎉',
    "group_news_intro_message" TEXT NOT NULL DEFAULT '📰 *Let’s go to today’s news!*

📰 *Vamos para a notícia do dia!*',
    "group_quiz_header_message" TEXT NOT NULL DEFAULT '📝 *Quiz do Dia*

🇺🇸 Let’s check your understanding of the news.

Hora de testar sua compreensão da notícia.
Responda com atenção e envie tudo em uma única mensagem. 🚀',
    "group_quiz_footer_message" TEXT NOT NULL DEFAULT '📩 Responda enviando `A`, `B`, `C` ou no formato `1A`, `2B`, `3C`.

🍀 Boa sorte!',
    "group_delay_seconds" INTEGER NOT NULL DEFAULT 3,
    "group_simulate_typing" BOOLEAN NOT NULL DEFAULT true,
    "ai_temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "ai_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "min_delay" INTEGER NOT NULL DEFAULT 1,
    "max_delay" INTEGER NOT NULL DEFAULT 5,
    "messages_per_minute" INTEGER NOT NULL DEFAULT 10,
    "response_timeout" INTEGER NOT NULL DEFAULT 30,
    "system_prompt" TEXT NOT NULL DEFAULT 'You are a helpful English teacher.',
    "allowed_response_start" TEXT NOT NULL DEFAULT '00:00',
    "allowed_response_end" TEXT NOT NULL DEFAULT '23:59',
    "ignored_groups" JSONB NOT NULL DEFAULT '[]',
    "ignored_contacts" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageSettingsHistory" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "previous_settings" JSONB NOT NULL,
    "new_settings" JSONB NOT NULL,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageSettingsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageSettings_teacher_id_key" ON "MessageSettings"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsapp_instance_name_key" ON "User"("whatsapp_instance_name");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioSubmission" ADD CONSTRAINT "AudioSubmission_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingFeedback" ADD CONSTRAINT "SpeakingFeedback_audio_submission_id_fkey" FOREIGN KEY ("audio_submission_id") REFERENCES "AudioSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSettings" ADD CONSTRAINT "MessageSettings_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSettingsHistory" ADD CONSTRAINT "MessageSettingsHistory_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
