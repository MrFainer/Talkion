-- Seed/update all credit action configs with UUID generation
INSERT INTO "CreditActionConfig" ("id", "key", "name", "description", "category", "default_cost", "current_cost", "updated_at")
VALUES
  (gen_random_uuid(), 'news_capture_level_1', 'Captura de notícia Nível 1', 'Captura de notícia por scraping para nível 1', 'content', 10, 10, NOW()),
  (gen_random_uuid(), 'news_capture_level_2', 'Captura de notícia Nível 2', 'Captura de notícia por scraping para nível 2', 'content', 10, 10, NOW()),
  (gen_random_uuid(), 'news_capture_level_3', 'Captura de notícia Nível 3', 'Captura de notícia por scraping para nível 3', 'content', 10, 10, NOW()),
  (gen_random_uuid(), 'news_ai_fallback', 'Notícia gerada por IA (fallback)', 'Geração de notícia via IA quando scraping falha', 'content', 20, 20, NOW()),
  (gen_random_uuid(), 'news_tts', 'Áudio TTS da notícia', 'Geração de áudio por texto-fala para notícia', 'content', 5, 5, NOW()),
  (gen_random_uuid(), 'quiz_generation', 'Quiz gerado para um nível', 'Geração de quiz para uma notícia em um nível', 'content', 10, 10, NOW()),
  (gen_random_uuid(), 'quick_tip_generation', 'Geração de Quick Tip', 'Geração de dica de inglês via IA para grupos', 'content', 5, 5, NOW()),
  (gen_random_uuid(), 'news_quiz_group_send', 'Envio da notícia + quiz para grupo', 'Envio da notícia e quiz para grupo de WhatsApp', 'distribution', 2, 2, NOW()),
  (gen_random_uuid(), 'quiz_response_received', 'Receber resposta do quiz', 'Processamento de resposta de quiz recebida', 'distribution', 1, 1, NOW()),
  (gen_random_uuid(), 'quiz_response_metrics', 'Salvar métricas da resposta', 'Armazenamento de métricas da resposta do quiz', 'distribution', 1, 1, NOW()),
  (gen_random_uuid(), 'news_individual_send', 'Envio individual de notícia', 'Envio de notícia individual para aluno', 'distribution', 1, 1, NOW()),
  (gen_random_uuid(), 'speaking_transcription', 'Transcrição de áudio', 'Transcrição de áudio do aluno via IA', 'speaking', 10, 10, NOW()),
  (gen_random_uuid(), 'speaking_feedback', 'Feedback da IA', 'Geração de feedback de speaking pela IA', 'speaking', 15, 15, NOW()),
  (gen_random_uuid(), 'lesson_confirmation_send', 'Envio de confirmação de aula', 'Envio de mensagem de confirmação de aula', 'lessons', 1, 1, NOW()),
  (gen_random_uuid(), 'lesson_confirmation_process', 'Interpretação da resposta pela IA', 'Processamento da resposta de confirmação pela IA', 'lessons', 1, 1, NOW()),
  (gen_random_uuid(), 'weekly_summary_send', 'Envio de resumo semanal', 'Envio de resumo semanal de aulas para o aluno', 'lessons', 1, 1, NOW()),
  (gen_random_uuid(), 'weekly_summary_process', 'Processamento de resposta do resumo semanal', 'Interpretação da resposta do resumo semanal pela IA', 'lessons', 1, 1, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "default_cost" = EXCLUDED."default_cost",
  "current_cost" = EXCLUDED."current_cost",
  "updated_at" = NOW();
