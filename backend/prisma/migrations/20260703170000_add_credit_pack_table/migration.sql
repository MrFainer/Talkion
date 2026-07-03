CREATE TABLE IF NOT EXISTS "CreditPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditPack_active_idx" ON "CreditPack"("active");

ALTER TABLE "CreditPack"
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "CreditPack"
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

UPDATE "CreditPack"
SET
    "created_at" = COALESCE("created_at", CURRENT_TIMESTAMP),
    "updated_at" = COALESCE("updated_at", CURRENT_TIMESTAMP)
WHERE "created_at" IS NULL OR "updated_at" IS NULL;

INSERT INTO "CreditPack" ("id", "name", "credits", "price", "active", "sort_order", "updated_at")
VALUES
    ('9d8b4b21-3e6b-4f4e-9e53-000000000001', '10.000 créditos', 10000, 39.90, true, 1, CURRENT_TIMESTAMP),
    ('9d8b4b21-3e6b-4f4e-9e53-000000000002', '25.000 créditos', 25000, 89.90, true, 2, CURRENT_TIMESTAMP),
    ('9d8b4b21-3e6b-4f4e-9e53-000000000003', '50.000 créditos', 50000, 169.90, true, 3, CURRENT_TIMESTAMP),
    ('9d8b4b21-3e6b-4f4e-9e53-000000000004', '100.000 créditos', 100000, 299.90, true, 4, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "credits" = EXCLUDED."credits",
    "price" = EXCLUDED."price",
    "active" = EXCLUDED."active",
    "sort_order" = EXCLUDED."sort_order",
    "updated_at" = CURRENT_TIMESTAMP;
