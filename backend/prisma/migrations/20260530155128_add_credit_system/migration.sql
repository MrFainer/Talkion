-- CreateTable
CREATE TABLE "CreditActionConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'content',
    "default_cost" INTEGER NOT NULL DEFAULT 5,
    "current_cost" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditActionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DEBIT',
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "action_key" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "max_students" INTEGER NOT NULL DEFAULT 50,
    "mercadopago_plan_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "additional_students" INTEGER NOT NULL DEFAULT 0,
    "max_students" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "CreditActionConfig_key_key" ON "CreditActionConfig"("key");

-- CreateIndex
CREATE INDEX "CreditTransaction_user_id_created_at_idx" ON "CreditTransaction"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "CreditTransaction_user_id_type_idx" ON "CreditTransaction"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_mercadopago_plan_id_key" ON "SubscriptionPlan"("mercadopago_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_mercadopago_subscription_id_key" ON "Subscription"("mercadopago_subscription_id");

-- CreateIndex
CREATE INDEX "Subscription_user_id_idx" ON "Subscription"("user_id");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_mercadopago_payment_id_key" ON "SubscriptionPayment"("mercadopago_payment_id");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscription_id_idx" ON "SubscriptionPayment"("subscription_id");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_mercadopago_payment_id_idx" ON "SubscriptionPayment"("mercadopago_payment_id");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
