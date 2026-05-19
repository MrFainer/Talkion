ALTER TABLE "MessageSettings"
DROP COLUMN IF EXISTS "private_delay_seconds",
DROP COLUMN IF EXISTS "private_simulate_typing",
DROP COLUMN IF EXISTS "group_delay_seconds",
DROP COLUMN IF EXISTS "group_simulate_typing";

