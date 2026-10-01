-- CreateEnum
CREATE TYPE "ConversationPurpose" AS ENUM ('CHAT', 'ARCHITECTURE_SEARCH');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "purpose" "ConversationPurpose" NOT NULL DEFAULT 'CHAT';

-- CreateIndex
CREATE INDEX "conversations_workspaceId_repositoryId_createdById_purpose_idx" ON "conversations"("workspaceId", "repositoryId", "createdById", "purpose");

-- One architecture thread per author and repository. Chat conversations stay unconstrained.
CREATE UNIQUE INDEX "conversations_architecture_thread_key" ON "conversations"("workspaceId", "repositoryId", "createdById", "purpose") WHERE "deletedAt" IS NULL AND "purpose" = 'ARCHITECTURE_SEARCH';
