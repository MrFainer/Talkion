INSERT INTO "CreditActionConfig" (key, name, description, category, default_cost, current_cost)
SELECT 'weekly_summary_send', 'Envio de resumo semanal', 'Envio de resumo semanal de aulas para o aluno', 'lessons', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM "CreditActionConfig" WHERE key = 'weekly_summary_send');

INSERT INTO "CreditActionConfig" (key, name, description, category, default_cost, current_cost)
SELECT 'weekly_summary_process', 'Processamento de resposta do resumo semanal', 'Interpretação da resposta do resumo semanal pela IA', 'lessons', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM "CreditActionConfig" WHERE key = 'weekly_summary_process');
