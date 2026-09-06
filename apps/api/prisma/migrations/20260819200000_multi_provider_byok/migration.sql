-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GROK', 'GEMINI');

-- CreateTable
CREATE TABLE "workspace_ai_credentials" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "key_last4" VARCHAR(4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_ai_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_ai_credentials_workspace_id_provider_key" ON "workspace_ai_credentials"("workspace_id", "provider");

-- AddForeignKey
ALTER TABLE "workspace_ai_credentials" ADD CONSTRAINT "workspace_ai_credentials_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "workspace_ai_settings" ADD COLUMN "active_provider" "AiProvider";

-- Backfill: move existing OpenAI BYOK keys into workspace_ai_credentials and mark OpenAI active
INSERT INTO "workspace_ai_credentials" ("id", "workspace_id", "provider", "api_key_encrypted", "key_last4", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    "workspace_id",
    'OPENAI',
    "openai_api_key_encrypted",
    COALESCE("openai_key_last4", '????'),
    "created_at",
    "updated_at"
FROM "workspace_ai_settings"
WHERE "openai_api_key_encrypted" IS NOT NULL;

UPDATE "workspace_ai_settings"
SET "active_provider" = 'OPENAI'
WHERE "openai_api_key_encrypted" IS NOT NULL;

-- AlterTable
ALTER TABLE "workspace_ai_settings" DROP COLUMN "openai_api_key_encrypted";
ALTER TABLE "workspace_ai_settings" DROP COLUMN "openai_key_last4";
