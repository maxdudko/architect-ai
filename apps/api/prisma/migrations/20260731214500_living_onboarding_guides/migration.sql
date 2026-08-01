-- CreateEnum
CREATE TYPE "GuideType" AS ENUM ('EXECUTIVE_SUMMARY', 'PROJECT_OVERVIEW', 'FOLDER', 'MODULE', 'SERVICE', 'TECHNOLOGY_STACK', 'READING_ORDER', 'GLOSSARY', 'COMMON_PITFALLS');

-- CreateEnum
CREATE TYPE "GuideGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "GuideGenerationTrigger" AS ENUM ('INITIAL_INDEX', 'MANUAL_GENERATE', 'MANUAL_REGENERATE', 'REINDEX');

-- CreateTable
CREATE TABLE "guides" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "type" "GuideType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB NOT NULL,
    "generationVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceIndexingRunId" UUID,
    "sourceCommitSha" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_generation_runs" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "trigger" "GuideGenerationTrigger" NOT NULL,
    "status" "GuideGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedTypes" "GuideType"[],
    "totalGuideCount" INTEGER NOT NULL DEFAULT 0,
    "completedGuideCount" INTEGER NOT NULL DEFAULT 0,
    "sourceIndexingRunId" UUID,
    "sourceCommitSha" TEXT,
    "error" TEXT,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guides_repository_id_type_slug_key" ON "guides"("repositoryId", "type", "slug");

-- CreateIndex
CREATE INDEX "guides_workspace_id_repository_id_idx" ON "guides"("workspaceId", "repositoryId");

-- CreateIndex
CREATE INDEX "guides_repository_id_type_idx" ON "guides"("repositoryId", "type");

-- CreateIndex
CREATE INDEX "guide_generation_runs_workspace_repository_idx" ON "guide_generation_runs"("workspaceId", "repositoryId");

-- CreateIndex
CREATE INDEX "guide_generation_runs_repository_status_created_idx" ON "guide_generation_runs"("repositoryId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "guides_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_generation_runs" ADD CONSTRAINT "guide_generation_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_generation_runs" ADD CONSTRAINT "guide_generation_runs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
