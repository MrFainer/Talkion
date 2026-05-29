-- AlterTable: Add credit_balance to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "credit_balance" DOUBLE PRECISION NOT NULL DEFAULT 0;
