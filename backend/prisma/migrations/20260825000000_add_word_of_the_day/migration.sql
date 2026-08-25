-- AlterEnum
ALTER TYPE "CostAction" ADD VALUE 'WORD_OF_THE_DAY_GENERATION';

-- AlterTable
ALTER TABLE "MessageSettings" ADD COLUMN "word_of_the_day_time" VARCHAR(5) NOT NULL DEFAULT '18:00',
ADD COLUMN "word_of_the_day_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "admin_word_of_the_day_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Insert CreditActionConfig for word_of_the_day_generation
INSERT INTO "CreditActionConfig" ("id", "key", "name", "description", "category", "default_cost", "current_cost", "updated_at")
VALUES (gen_random_uuid(), 'word_of_the_day_generation', 'Geração de Word of the Day', 'Geração de palavra do dia em inglês via IA para grupos', 'content', 5, 5, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "default_cost" = EXCLUDED."default_cost",
  "current_cost" = EXCLUDED."current_cost",
  "updated_at" = NOW();
