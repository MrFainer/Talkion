-- AlterTable
ALTER TABLE "QuizAnswer"
ADD COLUMN "submitted_text" TEXT,
ADD COLUMN "correct_answer" TEXT;

-- AlterTable
ALTER TABLE "WhatsappMessage"
ALTER COLUMN "student_id" DROP NOT NULL,
ADD COLUMN "remote_jid" TEXT,
ADD COLUMN "external_message_id" TEXT,
ADD COLUMN "quoted_message_id" TEXT,
ADD COLUMN "related_news_id" TEXT,
ADD COLUMN "related_quiz_id" TEXT,
ADD COLUMN "content_kind" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_external_message_id_key"
ON "WhatsappMessage"("external_message_id");
