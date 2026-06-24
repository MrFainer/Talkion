-- Add news_tts_fallback credit action config (higher cost for AI TTS fallback)
INSERT INTO "CreditActionConfig" ("id", "key", "name", "description", "category", "default_cost", "current_cost", "updated_at")
VALUES
  (gen_random_uuid(), 'news_tts_fallback', 'Áudio TTS fallback da notícia', 'Geração de áudio por texto-fala quando download do SoundCloud falha', 'content', 10, 10, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "default_cost" = EXCLUDED."default_cost",
  "current_cost" = EXCLUDED."current_cost",
  "updated_at" = NOW();
