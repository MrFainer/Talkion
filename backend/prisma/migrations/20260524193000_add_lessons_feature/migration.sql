-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('RECURRING', 'EXTRA');

-- AlterTable
ALTER TABLE "MessageSettings"
ADD COLUMN IF NOT EXISTS "lessons_confirmation_time" VARCHAR(5);

UPDATE "MessageSettings"
SET "lessons_confirmation_time" = '08:00'
WHERE "lessons_confirmation_time" IS NULL;

ALTER TABLE "MessageSettings"
ALTER COLUMN "lessons_confirmation_time" SET DEFAULT '08:00';

ALTER TABLE "MessageSettings"
ALTER COLUMN "lessons_confirmation_time" SET NOT NULL;

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "kind" "LessonKind" NOT NULL DEFAULT 'RECURRING',
    "weekday" INTEGER,
    "date" TIMESTAMP(3),
    "time" VARCHAR(5) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonConfirmation" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "occurrence_date" TIMESTAMP(3) NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'PENDING',
    "request_message_id" TEXT,
    "response_message_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lesson_student_id_idx" ON "Lesson"("student_id");

-- CreateIndex
CREATE INDEX "Lesson_weekday_time_idx" ON "Lesson"("weekday", "time");

-- CreateIndex
CREATE INDEX "Lesson_date_time_idx" ON "Lesson"("date", "time");

-- CreateIndex
CREATE UNIQUE INDEX "LessonConfirmation_lesson_id_occurrence_date_key" ON "LessonConfirmation"("lesson_id", "occurrence_date");

-- CreateIndex
CREATE INDEX "LessonConfirmation_occurrence_date_status_idx" ON "LessonConfirmation"("occurrence_date", "status");

-- CreateIndex
CREATE INDEX "LessonConfirmation_request_message_id_idx" ON "LessonConfirmation"("request_message_id");

-- AddForeignKey
ALTER TABLE "Lesson"
ADD CONSTRAINT "Lesson_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonConfirmation"
ADD CONSTRAINT "LessonConfirmation_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

