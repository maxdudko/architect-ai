-- AlterEnum
ALTER TYPE "RepositoryStatus" ADD VALUE 'CHUNKING';

-- CreateEnum
CREATE TYPE "IndexingRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "IndexingTrigger" AS ENUM ('INITIAL_CONNECT', 'MANUAL_RETRY', 'MANUAL_REINDEX');

-- CreateEnum
CREATE TYPE "CodeSymbolType" AS ENUM ('FUNCTION', 'CLASS', 'METHOD', 'INTERFACE');

-- CreateTable
CREATE TABLE "indexing_runs" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "trigger" "IndexingTrigger" NOT NULL,
    "status" "IndexingRunStatus" NOT NULL,
    "branch" TEXT,
    "commitSha" TEXT,
    "clonePath" TEXT,
    "supportedFileCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredFileCount" INTEGER NOT NULL DEFAULT 0,
    "symbolCount" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "embeddingCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "indexing_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_files" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "indexingRunId" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_symbols" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "indexingRunId" UUID NOT NULL,
    "fileId" UUID,
    "filePath" TEXT NOT NULL,
    "type" "CodeSymbolType" NOT NULL,
    "name" TEXT NOT NULL,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "indexingRunId" UUID NOT NULL,
    "fileId" UUID,
    "symbolId" UUID,
    "filePath" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "startLine" INTEGER,
    "endLine" INTEGER,
    "vectorId" TEXT,
    "language" TEXT,
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indexing_runs_repositoryId_idx" ON "indexing_runs"("repositoryId");

-- CreateIndex
CREATE INDEX "indexing_runs_status_idx" ON "indexing_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "repository_files_run_path_key" ON "repository_files"("repositoryId", "indexingRunId", "path");

-- CreateIndex
CREATE INDEX "repository_files_repositoryId_idx" ON "repository_files"("repositoryId");

-- CreateIndex
CREATE INDEX "repository_files_indexingRunId_idx" ON "repository_files"("indexingRunId");

-- CreateIndex
CREATE INDEX "code_symbols_repositoryId_idx" ON "code_symbols"("repositoryId");

-- CreateIndex
CREATE INDEX "code_symbols_indexingRunId_idx" ON "code_symbols"("indexingRunId");

-- CreateIndex
CREATE INDEX "code_symbols_filePath_idx" ON "code_symbols"("filePath");

-- CreateIndex
CREATE INDEX "chunks_repositoryId_idx" ON "chunks"("repositoryId");

-- CreateIndex
CREATE INDEX "chunks_indexingRunId_idx" ON "chunks"("indexingRunId");

-- CreateIndex
CREATE INDEX "chunks_symbolId_idx" ON "chunks"("symbolId");

-- AddForeignKey
ALTER TABLE "indexing_runs" ADD CONSTRAINT "indexing_runs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_indexingRunId_fkey" FOREIGN KEY ("indexingRunId") REFERENCES "indexing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_symbols" ADD CONSTRAINT "code_symbols_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_symbols" ADD CONSTRAINT "code_symbols_indexingRunId_fkey" FOREIGN KEY ("indexingRunId") REFERENCES "indexing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_symbols" ADD CONSTRAINT "code_symbols_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "repository_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_indexingRunId_fkey" FOREIGN KEY ("indexingRunId") REFERENCES "indexing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "repository_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "code_symbols"("id") ON DELETE SET NULL ON UPDATE CASCADE;
