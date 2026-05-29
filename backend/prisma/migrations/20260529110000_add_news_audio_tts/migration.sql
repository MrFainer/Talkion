-- AlterEnum (safe: only adds if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'CostAction'
    AND pg_enum.enumlabel = 'NEWS_TTS_GENERATION'
  ) THEN
    ALTER TYPE "CostAction" ADD VALUE 'NEWS_TTS_GENERATION';
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "News" ADD COLUMN IF NOT EXISTS "audio_url" TEXT;
