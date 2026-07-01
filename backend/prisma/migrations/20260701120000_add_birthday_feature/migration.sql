-- Add birthday field to Student
ALTER TABLE "Student" ADD COLUMN "birthday" TIMESTAMP(3);

-- Add birthday automation fields to MessageSettings
ALTER TABLE "MessageSettings" ADD COLUMN "birthday_message_time" VARCHAR(5) NOT NULL DEFAULT '09:00';
ALTER TABLE "MessageSettings" ADD COLUMN "birthday_message_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MessageSettings" ADD COLUMN "birthday_message_template" TEXT;
ALTER TABLE "MessageSettings" ADD COLUMN "admin_birthday_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Add birthday_send credit action config
INSERT INTO "CreditActionConfig" ("id", "key", "name", "description", "category", "default_cost", "current_cost", "updated_at")
VALUES (gen_random_uuid(), 'birthday_send', 'Envio de mensagem de aniversário', 'Envio de mensagem de aniversário para o aluno', 'distribution', 5, 5, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "default_cost" = EXCLUDED."default_cost",
  "current_cost" = EXCLUDED."current_cost",
  "updated_at" = NOW();
