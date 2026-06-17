UPDATE "CreditActionConfig"
SET
  "name" = 'Captura de noticia Nivel 1',
  "description" = 'Captura de noticia por scraping para nivel 1',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_capture_level_1';

UPDATE "CreditActionConfig"
SET
  "name" = 'Captura de noticia Nivel 2',
  "description" = 'Captura de noticia por scraping para nivel 2',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_capture_level_2';

UPDATE "CreditActionConfig"
SET
  "name" = 'Captura de noticia Nivel 3',
  "description" = 'Captura de noticia por scraping para nivel 3',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_capture_level_3';

UPDATE "CreditActionConfig"
SET
  "name" = 'Noticia gerada por IA (fallback)',
  "description" = 'Geracao de noticia via IA quando scraping falha',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_ai_fallback';

UPDATE "CreditActionConfig"
SET
  "name" = 'Audio TTS da noticia',
  "description" = 'Geracao de audio por texto-fala para noticia',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'news_tts';

UPDATE "CreditActionConfig"
SET
  "name" = 'Quiz gerado para um nivel',
  "description" = 'Geracao de quiz para uma noticia em um nivel',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'quiz_generation';

UPDATE "CreditActionConfig"
SET
  "name" = 'Geracao de Quick Tip',
  "description" = 'Geracao de dica de ingles via IA para grupos',
  "category" = 'content',
  "updated_at" = NOW()
WHERE "key" = 'quick_tip_generation';

UPDATE "CreditActionConfig"
SET
  "name" = 'Envio da noticia + quiz para grupo',
  "description" = 'Envio da noticia e quiz para grupo de WhatsApp',
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
  "name" = 'Salvar metricas da resposta',
  "description" = 'Armazenamento de metricas da resposta do quiz',
  "category" = 'distribution',
  "updated_at" = NOW()
WHERE "key" = 'quiz_response_metrics';

UPDATE "CreditActionConfig"
SET
  "name" = 'Envio individual de noticia',
  "description" = 'Envio de noticia individual para aluno',
  "category" = 'distribution',
  "updated_at" = NOW()
WHERE "key" = 'news_individual_send';

UPDATE "CreditActionConfig"
SET
  "name" = 'Transcricao de audio',
  "description" = 'Transcricao de audio do aluno via IA',
  "category" = 'speaking',
  "updated_at" = NOW()
WHERE "key" = 'speaking_transcription';

UPDATE "CreditActionConfig"
SET
  "name" = 'Feedback da IA',
  "description" = 'Geracao de feedback de speaking pela IA',
  "category" = 'speaking',
  "updated_at" = NOW()
WHERE "key" = 'speaking_feedback';

UPDATE "CreditActionConfig"
SET
  "name" = 'Envio de confirmacao de aula',
  "description" = 'Envio de mensagem de confirmacao de aula',
  "category" = 'lessons',
  "updated_at" = NOW()
WHERE "key" = 'lesson_confirmation_send';

UPDATE "CreditActionConfig"
SET
  "name" = 'Interpretacao da resposta pela IA',
  "description" = 'Processamento da resposta de confirmacao pela IA',
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
  "description" = 'Interpretacao da resposta do resumo semanal pela IA',
  "category" = 'lessons',
  "updated_at" = NOW()
WHERE "key" = 'weekly_summary_process';
