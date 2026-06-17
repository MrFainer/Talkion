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

  // CreditActionConfig passa a ser mantido por migrations.

  // ─── Planos ──────────────────────────────────────────────────────
  const basePlanData = {
    name: 'Talkion Base',
    description: 'Plano ideal para professores com até 50 alunos',
    price: 84.90,
    credits: 15000,
    max_students: 50,
    active: true,
  };

  const existingBase = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Talkion Base' },
  });

  if (!existingBase) {
    await prisma.subscriptionPlan.create({ data: basePlanData });
    console.log('[setup] Plano criado: Talkion Base (R$84,90/mês)');
  } else {
    const baseUpdate = {};
    if (existingBase.max_students !== 50) baseUpdate.max_students = 50;
    if (existingBase.description !== basePlanData.description) baseUpdate.description = basePlanData.description;
    if (existingBase.price !== basePlanData.price) baseUpdate.price = basePlanData.price;
    if (Object.keys(baseUpdate).length > 0) {
      await prisma.subscriptionPlan.update({
        where: { id: existingBase.id },
        data: baseUpdate,
      });
      console.log('[setup] Plano Talkion Base atualizado.');
    }

    await prisma.subscription.updateMany({
      where: { plan_id: existingBase.id, max_students: { not: 50 } },
      data: { max_students: 50 },
    });
  }

  const premiumPlanData = {
    name: 'Talkion Premium',
    description: 'Plano completo para professores com até 100 alunos',
    price: 159.90,
    credits: 30000,
    max_students: 100,
    active: true,
  };

  const existingPremium = await prisma.subscriptionPlan.findFirst({
    where: { name: 'Talkion Premium' },
  });

  if (!existingPremium) {
    await prisma.subscriptionPlan.create({ data: premiumPlanData });
    console.log('[setup] Plano criado: Talkion Premium (R$159,90/mês)');
  } else {
    const premiumUpdate = {};
    if (existingPremium.max_students !== 100) premiumUpdate.max_students = 100;
    if (existingPremium.description !== premiumPlanData.description) premiumUpdate.description = premiumPlanData.description;
    if (existingPremium.price !== premiumPlanData.price) premiumUpdate.price = premiumPlanData.price;
    if (Object.keys(premiumUpdate).length > 0) {
      await prisma.subscriptionPlan.update({
        where: { id: existingPremium.id },
        data: premiumUpdate,
      });
      console.log('[setup] Plano Talkion Premium atualizado.');
    }

    await prisma.subscription.updateMany({
      where: { plan_id: existingPremium.id, max_students: { not: 100 } },
      data: { max_students: 100 },
    });
  }

  console.log('[setup] Setup concluído.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[setup] Erro:', err?.message || err);
  process.exit(1);
});
