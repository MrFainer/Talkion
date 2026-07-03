// Migration script: update old plans to new plans + update MP preapprovals
// Run: DATABASE_URL="postgresql://..." MERCADO_PAGO_ACCESS_TOKEN="..." node backend/prisma/migrate-plans.mjs
//
// What it does:
// 1. Creates/updates plans (Free, Essentials, Professional, School) with correct prices/features
// 2. Migrates active subscriptions from old plans (Talkion Base → Essentials, Talkion Premium → Professional)
// 3. Updates MP preapproval amounts to new prices
// 4. Deactivates orphan old plans

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const ADDITIONAL_STUDENT_PRICE = 3.90;

const FREE_FEATURES = {
  ai_content: true, speaking_ia: true, quiz: true, dashboard: false,
  private_flows: true, group_flows: true, student_management: true,
  automations: false, lesson_confirmation: false, scheduling: false,
  priority_support: false, multi_teacher: false, advanced_reports: false,
  admin_dashboard: false, api_integrations: false, dedicated_support: false,
  onboarding: false, affiliate_program: false, custom_messages: true,
  weekly_newsletter: true, content_studio: false,
};
const BASE_FEATURES = {
  ai_content: true, speaking_ia: true, quiz: true, dashboard: true,
  private_flows: true, group_flows: true, student_management: true,
  automations: true, lesson_confirmation: true, scheduling: true,
  priority_support: false, multi_teacher: false, advanced_reports: true,
  admin_dashboard: false, api_integrations: false, dedicated_support: false,
  onboarding: true, affiliate_program: true, custom_messages: true,
  weekly_newsletter: true, content_studio: true,
};
const PREMIUM_FEATURES = {
  ai_content: true, speaking_ia: true, quiz: true, dashboard: true,
  private_flows: true, group_flows: true, student_management: true,
  automations: true, lesson_confirmation: true, scheduling: true,
  priority_support: true, multi_teacher: false, advanced_reports: true,
  admin_dashboard: false, api_integrations: true, dedicated_support: false,
  onboarding: true, affiliate_program: true, custom_messages: true,
  weekly_newsletter: true, content_studio: true,
};
const SCHOOL_FEATURES = {
  ai_content: true, speaking_ia: true, quiz: true, dashboard: true,
  private_flows: true, group_flows: true, student_management: true,
  automations: true, lesson_confirmation: true, scheduling: true,
  priority_support: true, multi_teacher: true, advanced_reports: true,
  admin_dashboard: true, api_integrations: true, dedicated_support: true,
  onboarding: true, affiliate_program: true, custom_messages: true,
  weekly_newsletter: true, content_studio: true,
};

const PLAN_DEFS = [
  { name: 'Free', desc: 'Comece gratuitamente. Sem cartão de crédito.', price: 0, credits: 5000, max_students: 10, is_free: true, features: FREE_FEATURES, sort_order: 1 },
  { name: 'Essentials', desc: 'Para professores que querem automatizar suas aulas.', price: 99.90, credits: 20000, max_students: 50, is_free: false, features: BASE_FEATURES, sort_order: 2 },
  { name: 'Professional', desc: 'Cresça sem aumentar sua carga de trabalho.', price: 199.90, credits: 50000, max_students: 100, is_free: false, features: PREMIUM_FEATURES, sort_order: 3 },
  { name: 'School', desc: 'Para escolas e equipes de professores.', price: 399.90, credits: 120000, max_students: 250, max_teachers: 5, is_free: false, features: SCHOOL_FEATURES, sort_order: 4 },
];

const OLD_TO_NEW = {
  'Talkion Base': 'Essentials',
  'Talkion Premium': 'Professional',
};

async function upsertPlan(def) {
  const existing = await prisma.subscriptionPlan.findFirst({ where: { name: def.name } });
  if (!existing) {
    await prisma.subscriptionPlan.create({
      data: {
        name: def.name,
        description: def.desc,
        price: def.price,
        credits: def.credits,
        max_students: def.max_students,
        max_teachers: def.max_teachers || 1,
        is_free: def.is_free,
        features: def.features,
        active: true,
        sort_order: def.sort_order,
      },
    });
    console.log(`  ✓ Created plan: ${def.name} (R$${def.price})`);
  } else {
    await prisma.subscriptionPlan.update({
      where: { id: existing.id },
      data: {
        description: def.desc,
        price: def.price,
        credits: def.credits,
        max_students: def.max_students,
        max_teachers: def.max_teachers || 1,
        is_free: def.is_free,
        features: def.features,
        sort_order: def.sort_order,
      },
    });
    console.log(`  ✓ Updated plan: ${def.name} (R$${def.price})`);
  }
}

async function main() {
  console.log('=== Migration: Update Plans & Preapprovals ===\n');

  // Step 1: Upsert all plans
  console.log('Step 1: Syncing plans...');
  for (const def of PLAN_DEFS) {
    await upsertPlan(def);
  }

  // Step 2: Migrate active subscriptions from old plans
  console.log('\nStep 2: Migrating subscriptions...');
  for (const [oldName, newName] of Object.entries(OLD_TO_NEW)) {
    const oldPlan = await prisma.subscriptionPlan.findFirst({ where: { name: oldName } });
    const newPlan = await prisma.subscriptionPlan.findFirst({ where: { name: newName } });

    if (!oldPlan) {
      console.log(`  [SKIP] Old plan "${oldName}" not found.`);
      continue;
    }
    if (!newPlan) {
      console.log(`  [SKIP] New plan "${newName}" not found.`);
      continue;
    }

    const subs = await prisma.subscription.findMany({
      where: { plan_id: oldPlan.id, status: { in: ['active', 'pending'] } },
      include: { user: { select: { email: true } } },
    });

    console.log(`  ${oldName} → ${newName}: ${subs.length} active subscriptions`);

    for (const sub of subs) {
      const newTotal = newPlan.price + (sub.additional_students || 0) * ADDITIONAL_STUDENT_PRICE;

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { plan_id: newPlan.id, max_students: newPlan.max_students },
      });
      console.log(`    ✓ User ${sub.user.email}: DB updated (new total R$${newTotal.toFixed(2)})`);

      if (sub.mercadopago_subscription_id) {
        const MP_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!MP_TOKEN) {
          console.log(`    ✗ MP token missing — preapproval ${sub.mercadopago_subscription_id} NOT updated`);
          continue;
        }
        try {
          const res = await fetch(
            `https://api.mercadopago.com/preapproval/${sub.mercadopago_subscription_id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${MP_TOKEN}`,
              },
              body: JSON.stringify({
                auto_recurring: { transaction_amount: newTotal },
              }),
            },
          );
          if (res.ok) {
            console.log(`    ✓ MP preapproval ${sub.mercadopago_subscription_id} → R$${newTotal.toFixed(2)}`);
          } else {
            const err = await res.text();
            console.log(`    ✗ MP preapproval ${sub.mercadopago_subscription_id} failed: ${err}`);
          }
        } catch (err) {
          console.log(`    ✗ MP request error: ${err.message}`);
        }
      }
    }
  }

  // Step 3: Deactivate old plans
  console.log('\nStep 3: Deactivating old plans...');
  await prisma.subscriptionPlan.updateMany({
    where: { name: { in: Object.keys(OLD_TO_NEW) } },
    data: { active: false },
  });
  console.log('  ✓ Talkion Base and Talkion Premium deactivated');

  console.log('\n=== Migration complete ===');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
