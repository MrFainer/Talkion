-- CreateTable
CREATE TABLE "ContentHistory" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentHistory_teacher_id_type_sent_at_idx" ON "ContentHistory"("teacher_id", "type", "sent_at");

-- CreateIndex
CREATE INDEX "ContentHistory_teacher_id_type_content_idx" ON "ContentHistory"("teacher_id", "type", "content");
