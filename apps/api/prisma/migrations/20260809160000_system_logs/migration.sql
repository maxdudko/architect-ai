-- CreateEnum
CREATE TYPE "SystemLogCategory" AS ENUM ('HTTP', 'AUDIT');

-- CreateEnum
CREATE TYPE "SystemLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "system_logs" (
    "id" UUID NOT NULL,
    "category" "SystemLogCategory" NOT NULL,
    "level" "SystemLogLevel" NOT NULL DEFAULT 'INFO',
    "event" TEXT NOT NULL,
    "message" TEXT,
    "request_id" TEXT,
    "actor_type" TEXT,
    "actor_id" UUID,
    "workspace_id" UUID,
    "repository_id" UUID,
    "method" TEXT,
    "route" TEXT,
    "status_code" INTEGER,
    "latency_ms" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_logs_category_created_at_idx" ON "system_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at");

-- CreateIndex
CREATE INDEX "system_logs_event_created_at_idx" ON "system_logs"("event", "created_at");

-- CreateIndex
CREATE INDEX "system_logs_request_id_idx" ON "system_logs"("request_id");
