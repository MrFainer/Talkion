-- Seed/update plans with correct features, pricing, and names
-- Run: psql -h localhost -p 5433 -U talkion -d talkion_db -f backend/prisma/migrations/seed_plans.sql

BEGIN;

-- Update Free plan
UPDATE "SubscriptionPlan" SET
  description = 'Comece gratuitamente. Sem cartão de crédito.',
  price = 0,
  credits = 5000,
  max_students = 10,
  max_teachers = 1,
  is_free = true,
  active = true,
  sort_order = 1,
  features = '{
    "ai_content": true,
    "speaking_ia": true,
    "quiz": true,
    "dashboard": false,
    "private_flows": true,
    "group_flows": true,
    "student_management": true,
    "automations": false,
    "lesson_confirmation": false,
    "scheduling": false,
    "priority_support": false,
    "multi_teacher": false,
    "advanced_reports": false,
    "admin_dashboard": false,
    "api_integrations": false,
    "dedicated_support": false,
    "onboarding": false,
    "affiliate_program": false,
    "custom_messages": true,
    "weekly_newsletter": true,
    "content_studio": false
  }'::json
WHERE name = 'Free';

-- Rename & update Talkion Base -> Base
UPDATE "SubscriptionPlan" SET
  name = 'Base',
  description = 'Para professores que querem automatizar suas aulas.',
  price = 84.90,
  credits = 20000,
  max_students = 50,
  max_teachers = 1,
  is_free = false,
  active = true,
  sort_order = 2,
  features = '{
    "ai_content": true,
    "speaking_ia": true,
    "quiz": true,
    "dashboard": true,
    "private_flows": true,
    "group_flows": true,
    "student_management": true,
    "automations": true,
    "lesson_confirmation": true,
    "scheduling": true,
    "priority_support": false,
    "multi_teacher": false,
    "advanced_reports": true,
    "admin_dashboard": false,
    "api_integrations": false,
    "dedicated_support": false,
    "onboarding": true,
    "affiliate_program": true,
    "custom_messages": true,
    "weekly_newsletter": true,
    "content_studio": true
  }'::json
WHERE name = 'Talkion Base';

-- Rename & update Talkion Premium -> Premium
UPDATE "SubscriptionPlan" SET
  name = 'Premium',
  description = 'Cresça sem aumentar sua carga de trabalho.',
  price = 159.90,
  credits = 50000,
  max_students = 100,
  max_teachers = 1,
  is_free = false,
  active = true,
  sort_order = 3,
  features = '{
    "ai_content": true,
    "speaking_ia": true,
    "quiz": true,
    "dashboard": true,
    "private_flows": true,
    "group_flows": true,
    "student_management": true,
    "automations": true,
    "lesson_confirmation": true,
    "scheduling": true,
    "priority_support": true,
    "multi_teacher": false,
    "advanced_reports": true,
    "admin_dashboard": false,
    "api_integrations": true,
    "dedicated_support": false,
    "onboarding": true,
    "affiliate_program": true,
    "custom_messages": true,
    "weekly_newsletter": true,
    "content_studio": true
  }'::json
WHERE name = 'Talkion Premium';

-- Deactivate orphaned duplicate plans (created by old scripts)
UPDATE "SubscriptionPlan" SET active = false, sort_order = 99
WHERE name IN ('Base', 'Premium') AND id NOT IN (
  SELECT id FROM "SubscriptionPlan" WHERE name IN ('Talkion Base', 'Talkion Premium')
)
AND active = true;

-- Upsert School plan
INSERT INTO "SubscriptionPlan" (id, name, description, price, credits, max_students, max_teachers, is_free, features, active, sort_order)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  'School',
  'Para escolas e equipes de professores.',
  299.90,
  120000,
  250,
  5,
  false,
  '{
    "ai_content": true,
    "speaking_ia": true,
    "quiz": true,
    "dashboard": true,
    "private_flows": true,
    "group_flows": true,
    "student_management": true,
    "automations": true,
    "lesson_confirmation": true,
    "scheduling": true,
    "priority_support": true,
    "multi_teacher": true,
    "advanced_reports": true,
    "admin_dashboard": true,
    "api_integrations": true,
    "dedicated_support": true,
    "onboarding": true,
    "affiliate_program": true,
    "custom_messages": true,
    "weekly_newsletter": true,
    "content_studio": true
  }'::json,
  true,
  4
WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE name = 'School');

COMMIT;
