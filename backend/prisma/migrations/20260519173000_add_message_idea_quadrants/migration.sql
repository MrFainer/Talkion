ALTER TABLE "MessageSettings"
ADD COLUMN IF NOT EXISTS "private_greeting_idea" TEXT,
ADD COLUMN IF NOT EXISTS "private_speaking_intro_idea" TEXT,
ADD COLUMN IF NOT EXISTS "private_news_intro_idea" TEXT,
ADD COLUMN IF NOT EXISTS "group_greeting_idea" TEXT,
ADD COLUMN IF NOT EXISTS "group_quiz_header_idea" TEXT,
ADD COLUMN IF NOT EXISTS "group_news_intro_idea" TEXT;

