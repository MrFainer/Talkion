ALTER TABLE "MessageSettings"
ADD COLUMN IF NOT EXISTS "news_capture_time" VARCHAR(5);

ALTER TABLE "MessageSettings"
ADD COLUMN IF NOT EXISTS "private_news_send_time" VARCHAR(5);

ALTER TABLE "MessageSettings"
ADD COLUMN IF NOT EXISTS "group_news_send_time" VARCHAR(5);

UPDATE "MessageSettings"
SET "news_capture_time" = '08:00'
WHERE "news_capture_time" IS NULL;

UPDATE "MessageSettings"
SET "private_news_send_time" = '08:00'
WHERE "private_news_send_time" IS NULL;

UPDATE "MessageSettings"
SET "group_news_send_time" = '08:00'
WHERE "group_news_send_time" IS NULL;

ALTER TABLE "MessageSettings"
ALTER COLUMN "news_capture_time" SET DEFAULT '08:00',
ALTER COLUMN "private_news_send_time" SET DEFAULT '08:00',
ALTER COLUMN "group_news_send_time" SET DEFAULT '08:00';

ALTER TABLE "MessageSettings"
ALTER COLUMN "news_capture_time" SET NOT NULL,
ALTER COLUMN "private_news_send_time" SET NOT NULL,
ALTER COLUMN "group_news_send_time" SET NOT NULL;
