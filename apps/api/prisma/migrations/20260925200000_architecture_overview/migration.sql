-- CreateEnum
CREATE TYPE "ArchitectureOverviewGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ArchitectureOverviewGenerationTrigger" AS ENUM ('MANUAL_GENERATE', 'MANUAL_REGENERATE');

-- CreateTable
CREATE TABLE "architecture_overviews" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB NOT NULL,
    "generationVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceIndexingRunId" UUID NOT NULL,
    "sourceCommitSha" TEXT,
    "sourceBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "architecture_overviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_overview_generation_runs" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "trigger" "ArchitectureOverviewGenerationTrigger" NOT NULL,
    "status" "ArchitectureOverviewGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "sourceIndexingRunId" UUID,
    "sourceCommitSha" TEXT,
    "sourceBranch" TEXT,
    "completedStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 4,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "architecture_overview_generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "architecture_overviews_repositoryId_key" ON "architecture_overviews"("repositoryId");

-- CreateIndex
CREATE INDEX "architecture_overviews_workspace_repository_idx" ON "architecture_overviews"("workspaceId", "repositoryId");

-- CreateIndex
CREATE INDEX "architecture_overview_runs_workspace_repository_idx" ON "architecture_overview_generation_runs"("workspaceId", "repositoryId");

-- CreateIndex
CREATE INDEX "architecture_overview_runs_repository_status_created_idx" ON "architecture_overview_generation_runs"("repositoryId", "status", "createdAt");

-- One active overview generation per repository. Guide runs are a different table.
CREATE UNIQUE INDEX "architecture_overview_generation_runs_one_active"
ON "architecture_overview_generation_runs"("repositoryId")
WHERE "status" IN ('QUEUED', 'RUNNING');

-- AddForeignKey
ALTER TABLE "architecture_overviews" ADD CONSTRAINT "architecture_overviews_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_overviews" ADD CONSTRAINT "architecture_overviews_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_overview_generation_runs" ADD CONSTRAINT "architecture_overview_generation_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_overview_generation_runs" ADD CONSTRAINT "architecture_overview_generation_runs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
