-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('STANDARD', 'BYOK');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_contact_sales" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "stripe_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_mode" "BillingMode" NOT NULL,
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripe_price_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_prices_plan_mode_interval_key" ON "plan_prices"("plan_id", "billing_mode", "interval");

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "workspace_subscriptions" (
    "workspace_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "billing_mode" "BillingMode" NOT NULL DEFAULT 'STANDARD',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_subscription_item_id" TEXT,
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("workspace_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_subscriptions_stripe_subscription_id_key" ON "workspace_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "workspace_subscriptions_plan_id_idx" ON "workspace_subscriptions"("plan_id");

-- AddForeignKey
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- Seed the three fixed plans that replace the WorkspacePlan enum values.
-- Fixed UUIDs keep them stable across environments and let application code
-- (e.g. "revert to Free on cancellation") reference them without a lookup.
INSERT INTO "plans" ("id", "key", "name", "description", "is_contact_sales", "is_active", "sort_order", "created_at", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000001', 'free', 'Free', 'Validate the workflow with hosted AI and plan-based usage limits.', false, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000002', 'pro', 'PRO', 'Unlock higher usage limits with hosted AI or your own model key.', false, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000003', 'enterprise', 'Enterprise', 'Custom limits, governance, and support. Contact sales.', true, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed the PRO plan's standard and BYOK monthly prices ($20 and $12 respectively).
-- stripe_price_id is left NULL; BillingService creates the Stripe Price lazily on first use.
INSERT INTO "plan_prices" ("id", "plan_id", "billing_mode", "interval", "amount", "currency", "created_at", "updated_at") VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'STANDARD', 'MONTHLY', 2000, 'usd', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'BYOK', 'MONTHLY', 1200, 'usd', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: plan_limits.plan (enum) -> plan_limits.plan_id (FK)
ALTER TABLE "plan_limits" ADD COLUMN "plan_id" UUID;

UPDATE "plan_limits" SET "plan_id" = (CASE "plan"
  WHEN 'FREE' THEN '00000000-0000-0000-0000-000000000001'
  WHEN 'PRO' THEN '00000000-0000-0000-0000-000000000002'
  WHEN 'ENTERPRISE' THEN '00000000-0000-0000-0000-000000000003'
END)::uuid;

ALTER TABLE "plan_limits" ALTER COLUMN "plan_id" SET NOT NULL;

DROP INDEX "plan_limits_plan_metric_key";

ALTER TABLE "plan_limits" DROP COLUMN "plan";

CREATE UNIQUE INDEX "plan_limits_plan_id_metric_key" ON "plan_limits"("plan_id", "metric");

ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: workspaces.plan (enum) -> workspaces.plan_id (FK)
ALTER TABLE "workspaces" ADD COLUMN "plan_id" UUID;

UPDATE "workspaces" SET "plan_id" = (CASE "plan"
  WHEN 'FREE' THEN '00000000-0000-0000-0000-000000000001'
  WHEN 'PRO' THEN '00000000-0000-0000-0000-000000000002'
  WHEN 'ENTERPRISE' THEN '00000000-0000-0000-0000-000000000003'
END)::uuid;

ALTER TABLE "workspaces" ALTER COLUMN "plan_id" SET NOT NULL;

ALTER TABLE "workspaces" DROP COLUMN "plan";

CREATE INDEX "workspaces_plan_id_idx" ON "workspaces"("plan_id");

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropEnum
DROP TYPE "WorkspacePlan";
