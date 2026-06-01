-- Run this SQL manually in production to create the subscription tables
-- Generated for PostgreSQL

CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "mercadopago_plan_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_mercadopago_plan_id_key" ON "SubscriptionPlan"("mercadopago_plan_id");

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "mercadopago_customer_id" TEXT,
    "mercadopago_subscription_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "next_billing_date" TIMESTAMP(3),
    "card_last_four" TEXT,
    "card_holder_name" TEXT,
    "payment_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_mercadopago_subscription_id_key" ON "Subscription"("mercadopago_subscription_id");
CREATE INDEX "Subscription_user_id_idx" ON "Subscription"("user_id");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "mercadopago_payment_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "payment_method" TEXT,
    "paid_at" TIMESTAMP(3),
    "cycle_start" TIMESTAMP(3),
    "cycle_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPayment_mercadopago_payment_id_key" ON "SubscriptionPayment"("mercadopago_payment_id");
CREATE INDEX "SubscriptionPayment_subscription_id_idx" ON "SubscriptionPayment"("subscription_id");
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
