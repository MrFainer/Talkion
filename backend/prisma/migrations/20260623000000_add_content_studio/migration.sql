-- Add CONTENT_GENERATION to CostAction enum
ALTER TYPE "CostAction" ADD VALUE IF NOT EXISTS 'CONTENT_GENERATION';

-- Create ContentType enum
DO $$ BEGIN
  CREATE TYPE "ContentType" AS ENUM ('VOCABULARY', 'TIPS', 'QUIZ', 'INFORMATIVE', 'CURIOSITY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create ContentStatus enum
DO $$ BEGIN
  CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create Content table
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "trend_topic" TEXT,
    "trend_area" TEXT,
    "prompt_used" TEXT,
    "ai_model" TEXT,
    "generation_metadata" JSONB,
    "single_post" TEXT,
    "carousel" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "quiz_questions" JSONB,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'trend',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
ALTER TABLE "Content" ADD CONSTRAINT "Content_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("id") ON DELETE CASCADE;

-- Create indexes
CREATE INDEX "Content_teacher_id_status_deleted_at_idx" ON "Content"("teacher_id", "status", "deleted_at");
CREATE INDEX "Content_teacher_id_type_idx" ON "Content"("teacher_id", "type");
CREATE INDEX "Content_teacher_id_favorite_idx" ON "Content"("teacher_id", "favorite");
CREATE INDEX "Content_teacher_id_created_at_idx" ON "Content"("teacher_id", "created_at");

-- Seed credit action config for content_generation
INSERT INTO "CreditActionConfig" ("id", "key", "name", "description", "category", "default_cost", "current_cost", "updated_at")
VALUES (gen_random_uuid(), 'content_generation', 'Geração de conteúdo educacional', 'Geração de conteúdo de inglês baseado em tendências', 'content', 10, 10, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "default_cost" = EXCLUDED."default_cost",
  "current_cost" = EXCLUDED."current_cost",
  "updated_at" = NOW();
