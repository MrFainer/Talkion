UPDATE "CreditActionConfig"
SET
  "name" = 'Captura de notícia Nível 1',
  "description" = 'Captura de notícia por scraping para nível 1',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_capture_level_1';

UPDATE "CreditActionConfig"
SET
  "name" = 'Captura de notícia Nível 2',
  "description" = 'Captura de notícia por scraping para nível 2',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_capture_level_2';

UPDATE "CreditActionConfig"
SET
  "name" = 'Captura de notícia Nível 3',
  "description" = 'Captura de notícia por scraping para nível 3',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_capture_level_3';

UPDATE "CreditActionConfig"
SET
  "name" = 'Notícia gerada por IA (fallback)',
  "description" = 'Geração de notícia via IA quando scraping falha',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_ai_fallback';

UPDATE "CreditActionConfig"
SET
  "name" = 'Áudio TTS da notícia',
  "description" = 'Geração de áudio por texto-fala para notícia',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_tts';

UPDATE "CreditActionConfig"
SET
  "name" = 'Quiz gerado para um nível',
  "description" = 'Geração de quiz para uma notícia em um nível',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'quiz_generation';

UPDATE "CreditActionConfig"
SET
  "name" = 'Geração de Quick Tip',
  "description" = 'Geração de dica de inglês via IA para grupos',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'quick_tip_generation';

UPDATE "CreditActionConfig"
SET
  "name" = 'Envio da notícia + quiz para grupo',
  "description" = 'Envio da notícia e quiz para grupo de WhatsApp',
  "category" = 'distribution',
  "updated_at" = NOW()
WHERE "key" = 'news_quiz_group_send';

UPDATE "CreditActionConfig"
SET
  "name" = 'Receber resposta do quiz',
  "description" = 'Processamento de resposta de quiz recebida',
  "category" = 'distribution',
  "updated_at" = NOW()
WHERE "key" = 'quiz_response_received';

UPDATE "CreditActionConfig"
SET
  "name" = 'Salvar métricas da resposta',
  "description" = 'Armazenamento de métricas da resposta do quiz',
  "category" = 'distribution',
  "updated_at" = NOW()
WHERE "key" = 'quiz_response_metrics';

UPDATE "CreditActionConfig"
SET
  "name" = 'Envio individual de notícia',
  "description" = 'Envio de notícia individual para aluno',
  "category" = 'distribution',
  "updated_at" = NOW()
WHERE "key" = 'news_individual_send';

UPDATE "CreditActionConfig"
SET
  "name" = 'Transcrição de áudio',
  "description" = 'Transcrição de áudio do aluno via IA',
  "category" = 'speaking',
  "updated_at" = NOW()
WHERE "key" = 'speaking_transcription';

UPDATE "CreditActionConfig"
SET
  "name" = 'Feedback da IA',
  "description" = 'Geração de feedback de speaking pela IA',
  "category" = 'speaking',
  "updated_at" = NOW()
WHERE "key" = 'speaking_feedback';

UPDATE "CreditActionConfig"
SET
  "name" = 'Envio de confirmação de aula',
  "description" = 'Envio de mensagem de confirmação de aula',
  "category" = 'lessons',
  "updated_at" = NOW()
WHERE "key" = 'lesson_confirmation_send';

UPDATE "CreditActionConfig"
SET
  "name" = 'Interpretação da resposta pela IA',
  "description" = 'Processamento da resposta de confirmação pela IA',
  "category" = 'lessons',
  "updated_at" = NOW()
WHERE "key" = 'lesson_confirmation_process';

UPDATE "CreditActionConfig"
SET
  "name" = 'Envio de resumo semanal',
  "description" = 'Envio de resumo semanal de aulas para o aluno',
  "category" = 'lessons',
  "updated_at" = NOW()
WHERE "key" = 'weekly_summary_send';

UPDATE "CreditActionConfig"
SET
  "name" = 'Processamento de resposta do resumo semanal',
  "description" = 'Interpretação da resposta do resumo semanal pela IA',
  "category" = 'lessons',
  "updated_at" = NOW()
WHERE "key" = 'weekly_summary_process';
