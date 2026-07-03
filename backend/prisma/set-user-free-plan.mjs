import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

function buildPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não está definido.');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return { prisma: new PrismaClient({ adapter }), pool };
}

async function cancelMercadoPagoPreapproval(id) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token || !id) {
    return { cancelled: false, skipped: true };
  }

  const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao cancelar preapproval ${id}: ${body}`);
  }

  return { cancelled: true, skipped: false };
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Informe o e-mail. Ex: node prisma/set-user-free-plan.mjs cristianfainer@gmail.com');
  }

  const { prisma, pool } = buildPrisma();

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, credit_balance: true },
    });

    if (!user) {
      throw new Error(`Usuário não encontrado: ${email}`);
    }

    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: {
        active: true,
        OR: [{ is_free: true }, { name: 'Free' }],
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        name: true,
        credits: true,
        max_students: true,
      },
    });

    if (!freePlan) {
      throw new Error('Plano Free não encontrado.');
    }

    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        user_id: user.id,
        status: { in: ['active', 'pending', 'paused', 'past_due'] },
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        plan_id: true,
        mercadopago_subscription_id: true,
      },
    });

    if (currentSubscription?.mercadopago_subscription_id) {
      await cancelMercadoPagoPreapproval(currentSubscription.mercadopago_subscription_id);
      console.log(`✓ Preapproval cancelado: ${currentSubscription.mercadopago_subscription_id}`);
    }

    const now = new Date();

    if (currentSubscription) {
      await prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          plan_id: freePlan.id,
          status: 'active',
          max_students: freePlan.max_students,
          additional_students: 0,
          mercadopago_subscription_id: null,
          mercadopago_card_id: null,
          mercadopago_customer_id: null,
          card_last_four: null,
          card_holder_name: null,
          next_billing_date: null,
          payment_method: null,
          updated_at: now,
        },
      });
      console.log(`✓ Assinatura atualizada para o plano ${freePlan.name}`);
    } else {
      await prisma.subscription.create({
        data: {
          user_id: user.id,
          plan_id: freePlan.id,
          status: 'active',
          max_students: freePlan.max_students,
        },
      });
      console.log(`✓ Assinatura Free criada para ${email}`);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { credit_balance: freePlan.credits },
      }),
      prisma.creditTransaction.create({
        data: {
          user_id: user.id,
          type: 'CREDIT',
          amount: freePlan.credits,
          balance_after: freePlan.credits,
          description: `Créditos do plano ${freePlan.name}`,
          reference_type: 'free_plan',
        },
      }),
    ]);

    console.log(`✓ Créditos ajustados para ${freePlan.credits}`);
    console.log(`✓ Usuário ${user.email} (${user.name}) agora está no plano ${freePlan.name}`);

    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    await prisma.$disconnect();
    await pool.end();
    throw error;
  }
}

main().catch((error) => {
  console.error('Falha ao colocar usuário no plano Free:', error);
  process.exit(1);
});
