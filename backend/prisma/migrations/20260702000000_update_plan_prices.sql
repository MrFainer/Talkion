-- Migration: update plan prices to correct values
UPDATE "SubscriptionPlan" SET price = 0 WHERE name = 'Free';
UPDATE "SubscriptionPlan" SET price = 99.90 WHERE name = 'Essentials';
UPDATE "SubscriptionPlan" SET price = 199.90 WHERE name = 'Professional';
UPDATE "SubscriptionPlan" SET price = 399.90 WHERE name = 'School';
