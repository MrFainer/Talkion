-- Fix plan activation
-- The renamed Base (84.90, 20000 credits) and Premium (159.90, 50000 credits) are inactive
-- The orphan Base (99.90) and Premium (199.90) are also inactive
-- Only Free and School are active

BEGIN;

-- Reactivate the correct Base (price=84.9, 20000 credits, was Talkion Base)
UPDATE "SubscriptionPlan" SET
  active = true,
  sort_order = 2
WHERE price = 84.9 AND credits = 20000 AND name = 'Base';

-- Reactivate the correct Premium (price=159.9, 50000 credits, was Talkion Premium)
UPDATE "SubscriptionPlan" SET
  active = true,
  sort_order = 3
WHERE price = 159.9 AND credits = 50000 AND name = 'Premium';

-- Deactivate orphan Base (99.90)
UPDATE "SubscriptionPlan" SET active = false WHERE price = 99.9 AND name = 'Base';

-- Deactivate orphan Premium (199.90)
UPDATE "SubscriptionPlan" SET active = false WHERE price = 199.9 AND name = 'Premium';

COMMIT;
