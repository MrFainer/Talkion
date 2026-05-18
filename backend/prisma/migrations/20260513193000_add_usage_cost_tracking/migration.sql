-- CreateEnum
CREATE TYPE "CostProvider" AS ENUM ('OPENAI', 'EVOLUTION');

-- CreateEnum
CREATE TYPE "CostAction" AS ENUM (
  'NEWS_FALLBACK_GENERATION',
  'QUIZ_GENERATION',
  'SPEAKING_TRANSCRIPTION',
  'SPEAKING_EVALUATION',
  'WHATSAPP_MESSAGE_SEND',
  'WHATSAPP_MESSAGE_RECEIVE'
);

-- AlterTable
ALTER TABLE "Student"
ALTER COLUMN "user_id" DROP NOT NULL,
ADD COLUMN "teacher_id" TEXT;

-- Backfill minimo: usa o user_id atual como teacher_id enquanto o login do professor
-- ainda nao foi separado do eventual login do aluno.
UPDATE "Student"
SET "teacher_id" = "user_id"
WHERE "teacher_id" IS NULL
  AND "user_id" IS NOT NULL;

-- AlterTable
ALTER TABLE "WhatsappGroup"
ADD COLUMN "teacher_id" TEXT;

-- CreateTable
CREATE TABLE "UsageCostEvent" (
  "id" TEXT NOT NULL,
  "teacher_id" TEXT,
  "student_id" TEXT,
  "provider" "CostProvider" NOT NULL,
  "action" "CostAction" NOT NULL,
  "model_name" TEXT,
  "reference_type" TEXT,
  "reference_id" TEXT,
  "news_id" TEXT,
  "quiz_id" TEXT,
  "whatsapp_message_id" TEXT,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "cached_input_tokens" INTEGER,
  "audio_seconds" INTEGER,
  "quantity" DOUBLE PRECISION,
  "unit" TEXT,
  "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "estimated_cost_brl" DOUBLE PRECISION,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UsageCostEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageCostEvent_teacher_id_created_at_idx"
ON "UsageCostEvent"("teacher_id", "created_at");

-- CreateIndex
CREATE INDEX "UsageCostEvent_student_id_created_at_idx"
ON "UsageCostEvent"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "UsageCostEvent_provider_action_created_at_idx"
ON "UsageCostEvent"("provider", "action", "created_at");

-- AddForeignKey
ALTER TABLE "Student"
ADD CONSTRAINT "Student_teacher_id_fkey"
FOREIGN KEY ("teacher_id") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappGroup"
ADD CONSTRAINT "WhatsappGroup_teacher_id_fkey"
FOREIGN KEY ("teacher_id") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCostEvent"
ADD CONSTRAINT "UsageCostEvent_teacher_id_fkey"
FOREIGN KEY ("teacher_id") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCostEvent"
ADD CONSTRAINT "UsageCostEvent_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "Student"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
