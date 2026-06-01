const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv/config');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('[setup] Iniciando setup de produção...');

  // ─── Credit Action Configs ────────────────────────────────────────
  const creditActions = [
    { key: 'news_capture_level_1', name: 'Captura de notícia Nível 1', description: 'Captura de notícia por scraping para nível 1', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'news_capture_level_2', name: 'Captura de notícia Nível 2', description: 'Captura de notícia por scraping para nível 2', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'news_capture_level_3', name: 'Captura de notícia Nível 3', description: 'Captura de notícia por scraping para nível 3', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'news_ai_fallback', name: 'Notícia gerada por IA (fallback)', description: 'Geração de notícia via IA quando scraping falha', category: 'content', default_cost: 15, current_cost: 15 },
    { key: 'news_tts', name: 'Áudio TTS da notícia', description: 'Geração de áudio por texto-fala para notícia', category: 'content', default_cost: 5, current_cost: 5 },
    { key: 'quiz_generation', name: 'Quiz gerado para um nível', description: 'Geração de quiz para uma notícia em um nível', category: 'content', default_cost: 10, current_cost: 10 },
    { key: 'news_quiz_group_send', name: 'Envio da notícia + quiz para grupo', description: 'Envio da notícia e quiz para grupo de WhatsApp', category: 'distribution', default_cost: 2, current_cost: 2 },
    { key: 'quiz_response_received', name: 'Receber resposta do quiz', description: 'Processamento de resposta de quiz recebida', category: 'distribution', default_cost: 1, current_cost: 1 },
    { key: 'quiz_response_metrics', name: 'Salvar métricas da resposta', description: 'Armazenamento de métricas da resposta do quiz', category: 'distribution', default_cost: 1, current_cost: 1 },
    { key: 'news_individual_send', name: 'Envio individual de notícia', description: 'Envio de notícia individual para aluno', category: 'distribution', default_cost: 1, current_cost: 1 },
    { key: 'speaking_transcription', name: 'Transcrição de áudio', description: 'Transcrição de áudio do aluno via IA', category: 'speaking', default_cost: 10, current_cost: 10 },
    { key: 'speaking_feedback', name: 'Feedback da IA', description: 'Geração de feedback de speaking pela IA', category: 'speaking', default_cost: 15, current_cost: 15 },
    { key: 'lesson_confirmation_send', name: 'Envio de confirmação de aula', description: 'Envio de mensagem de confirmação de aula', category: 'lessons', default_cost: 1, current_cost: 1 },
    { key: 'lesson_confirmation_process', name: 'Interpretação da resposta pela IA', description: 'Processamento da resposta de confirmação pela IA', category: 'lessons', default_cost: 1, current_cost: 1 },
  ];

  for (const action of creditActions) {
    const existing = await prisma.creditActionConfig.findUnique({ where: { key: action.key } });
    if (!existing) {
      await prisma.creditActionConfig.create({ data: action });
      console.log(`[setup] Credit action config criada: ${action.key} (${action.current_cost} créditos)`);
    }
  }

  // ─── Planos ──────────────────────────────────────────────────────
  const basePlanData = {
    name: 'Talkion Base',
    description: 'Plano ideal para professores com até 60 alunos',
    price: 79.90,
    credits: 15000,
    max_students: 60,
    active: true,
  };

  const existingBase = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Talkion Base' },
  });

  if (!existingBase) {
    await prisma.subscriptionPlan.create({ data: basePlanData });
    console.log('[setup] Plano criado: Talkion Base (R$79,90/mês)');
  } else {
    const baseUpdate = {};
    if (existingBase.max_students !== 60) baseUpdate.max_students = 60;
    if (existingBase.description !== basePlanData.description) baseUpdate.description = basePlanData.description;
    if (Object.keys(baseUpdate).length > 0) {
      await prisma.subscriptionPlan.update({
        where: { id: existingBase.id },
        data: baseUpdate,
      });
      console.log('[setup] Plano Talkion Base atualizado.');
    }

    await prisma.subscription.updateMany({
      where: { plan_id: existingBase.id, max_students: { not: 60 } },
      data: { max_students: 60 },
    });
  }

  const premiumPlanData = {
    name: 'Talkion Premium',
    description: 'Plano completo para professores com até 100 alunos',
    price: 149.90,
    credits: 30000,
    max_students: 100,
    active: true,
  };

  const existingPremium = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Talkion Premium' },
  });

  if (!existingPremium) {
    await prisma.subscriptionPlan.create({ data: premiumPlanData });
    console.log('[setup] Plano criado: Talkion Premium (R$149,90/mês)');
  } else {
    console.log('[setup] Plano Talkion Premium já existe.');
  }

  console.log('[setup] Setup concluído.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[setup] Erro:', err?.message || err);
  process.exit(1);
});
