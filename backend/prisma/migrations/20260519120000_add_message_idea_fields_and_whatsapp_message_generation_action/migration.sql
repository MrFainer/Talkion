-- Add enum value (safe if already exists)
DO $$
BEGIN
  ALTER TYPE "CostAction" ADD VALUE 'WHATSAPP_MESSAGE_GENERATION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add idea fields for AI message generation
ALTER TABLE "MessageSettings"
ADD COLUMN "private_message_idea" TEXT,
ADD COLUMN "group_message_idea" TEXT;

