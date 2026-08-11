import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const NEW_FREE_CREDITS = 2000;
const NEW_FREE_MAX_STUDENTS = 3;

function buildPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não está definido.');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return { prisma: new PrismaClient({ adapter }), pool };
}

async function main() {
  const resetBalance = process.argv.includes('--reset');
  const { prisma, pool } = buildPrisma();

  const freePlan = await prisma.subscriptionPlan.findFirst({
    where: { active: true, OR: [{ is_free: true }, { name: 'Free' }] },
    orderBy: { created_at: 'asc' },
    select: { id: true, name: true },
  });

  if (!freePlan) {
    throw new Error('Plano Free não encontrado.');
  }

  await prisma.subscriptionPlan.update({
    where: { id: freePlan.id },
    data: { credits: NEW_FREE_CREDITS, max_students: NEW_FREE_MAX_STUDENTS },
  });
  console.log(
    `✓ Plano Free garantido: ${NEW_FREE_CREDITS} créditos e ${NEW_FREE_MAX_STUDENTS} alunos.`,
  );

  const subscriptions = await prisma.subscription.findMany({
    where: {
      plan_id: freePlan.id,
      status: { in: ['active', 'pending', 'paused', 'past_due'] },
    },
    select: {
      id: true,
      user_id: true,
      max_students: true,
      user: { select: { name: true, email: true, credit_balance: true } },
    },
  });

  console.log(`\nAssinaturas Free encontradas: ${subscriptions.length}`);

  let subsUpdated = 0;
  let creditsReset = 0;
  let alreadyAtPlanCredits = 0;
  let balancesPreserved = 0;

  for (const sub of subscriptions) {
    if (sub.max_students !== NEW_FREE_MAX_STUDENTS) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          max_students: NEW_FREE_MAX_STUDENTS,
          additional_students: 0,
        },
      });
    }

    subsUpdated++;

    if (!resetBalance) {
      balancesPreserved++;
      console.log(
        `- ${sub.user.email} (${sub.user.name}): max_students=${NEW_FREE_MAX_STUDENTS}, saldo preservado (${Math.floor(sub.user.credit_balance)}).`,
      );
      continue;
    }

    const currentBalance = Math.floor(sub.user.credit_balance);

    if (currentBalance === NEW_FREE_CREDITS) {
      alreadyAtPlanCredits++;
      console.log(
        `- ${sub.user.email} (${sub.user.name}): já com ${currentBalance} créditos, nada a fazer.`,
      );
      continue;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: sub.user_id },
        data: { credit_balance: NEW_FREE_CREDITS },
      }),
      prisma.creditTransaction.create({
        data: {
          user_id: sub.user_id,
          type: 'CREDIT',
          amount: NEW_FREE_CREDITS,
          balance_after: NEW_FREE_CREDITS,
          description: `Créditos do plano ${freePlan.name} (atualização)`,
          reference_type: 'free_plan_update',
        },
      }),
    ]);
    creditsReset++;
    console.log(
      `✓ ${sub.user.email} (${sub.user.name}): saldo ${currentBalance} → ${NEW_FREE_CREDITS} créditos.`,
    );
  }

  console.log('\nResumo:');
  console.log(`  Assinaturas sincronizadas: ${subsUpdated}`);
  if (resetBalance) {
    console.log(`  Créditos resetados para ${NEW_FREE_CREDITS}: ${creditsReset}`);
    console.log(
      `  Já estavam com ${NEW_FREE_CREDITS}: ${alreadyAtPlanCredits}`,
    );
  } else {
    console.log(
      `  Saldo preservado (use --reset para zerar para ${NEW_FREE_CREDITS}): ${balancesPreserved}`,
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error('Falha ao sincronizar plano Free:', error);
  process.exit(1);
});