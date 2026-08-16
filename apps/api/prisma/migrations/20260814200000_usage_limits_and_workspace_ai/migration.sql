-- CreateEnum
CREATE TYPE "UsageMetric" AS ENUM ('REPOSITORIES', 'INDEXING_RUNS', 'GUIDE_GENERATIONS', 'AI_QUESTIONS', 'MEMBERS');

-- CreateEnum
CREATE TYPE "UsagePeriod" AS ENUM ('CURRENT', 'MONTHLY');

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateTable
CREATE TABLE "plan_limits" (
    "id" UUID NOT NULL,
    "plan" "WorkspacePlan" NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "period" "UsagePeriod" NOT NULL,
    "max_value" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_limits_plan_metric_key" ON "plan_limits"("plan", "metric");

-- CreateTable
CREATE TABLE "workspace_ai_settings" (
    "workspace_id" UUID NOT NULL,
    "openai_api_key_encrypted" TEXT,
    "openai_key_last4" VARCHAR(4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_ai_settings_pkey" PRIMARY KEY ("workspace_id")
);

-- AddForeignKey
ALTER TABLE "workspace_ai_settings" ADD CONSTRAINT "workspace_ai_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default plan limits (FREE is capped; PRO/ENTERPRISE are unlimited)
INSERT INTO "plan_limits" ("id", "plan", "metric", "period", "max_value", "updated_at") VALUES
  (gen_random_uuid(), 'FREE', 'REPOSITORIES', 'CURRENT', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FREE', 'INDEXING_RUNS', 'MONTHLY', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FREE', 'GUIDE_GENERATIONS', 'MONTHLY', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FREE', 'AI_QUESTIONS', 'MONTHLY', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FREE', 'MEMBERS', 'CURRENT', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PRO', 'REPOSITORIES', 'CURRENT', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PRO', 'INDEXING_RUNS', 'MONTHLY', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PRO', 'GUIDE_GENERATIONS', 'MONTHLY', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PRO', 'AI_QUESTIONS', 'MONTHLY', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PRO', 'MEMBERS', 'CURRENT', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ENTERPRISE', 'REPOSITORIES', 'CURRENT', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ENTERPRISE', 'INDEXING_RUNS', 'MONTHLY', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ENTERPRISE', 'GUIDE_GENERATIONS', 'MONTHLY', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ENTERPRISE', 'AI_QUESTIONS', 'MONTHLY', NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ENTERPRISE', 'MEMBERS', 'CURRENT', NULL, CURRENT_TIMESTAMP);
