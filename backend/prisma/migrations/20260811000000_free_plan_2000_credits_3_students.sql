-- Change Free plan: 3 students and 2000 credits (2-week trial)
-- Run: psql -h localhost -p 5433 -U talkion -d talkion_db -f backend/prisma/migrations/20260811000000_free_plan_2000_credits_3_students.sql

BEGIN;

UPDATE "SubscriptionPlan" SET
  credits = 2000,
  max_students = 3,
  updated_at = NOW()
WHERE name = 'Free';

COMMIT;