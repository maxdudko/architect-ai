-- AlterEnum
ALTER TYPE "CodeSymbolType" ADD VALUE IF NOT EXISTS 'ENUM';
ALTER TYPE "CodeSymbolType" ADD VALUE IF NOT EXISTS 'TYPE_ALIAS';
ALTER TYPE "CodeSymbolType" ADD VALUE IF NOT EXISTS 'VARIABLE';
ALTER TYPE "CodeSymbolType" ADD VALUE IF NOT EXISTS 'CONSTANT';
ALTER TYPE "CodeSymbolType" ADD VALUE IF NOT EXISTS 'NAMESPACE';
ALTER TYPE "CodeSymbolType" ADD VALUE IF NOT EXISTS 'MODULE';

-- CreateEnum
CREATE TYPE "SymbolRelationType" AS ENUM ('IMPORTS', 'EXPORTS', 'EXTENDS', 'IMPLEMENTS', 'CALLS', 'USES');

-- AlterTable
ALTER TABLE "indexing_runs"
ADD COLUMN "processing_duration_ms" INTEGER,
ADD COLUMN "errors" JSONB;

-- AlterTable
ALTER TABLE "repository_files"
ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "line_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "extension" TEXT NOT NULL DEFAULT '',
ADD COLUMN "generated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ignored" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "binary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "code_symbols"
ADD COLUMN "qualified_name" TEXT,
ADD COLUMN "language" TEXT,
ADD COLUMN "start_column" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "end_column" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "exported" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_async" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_static" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN "parent_symbol_id" UUID;

UPDATE "code_symbols"
SET "qualified_name" = "name",
    "language" = 'typescript'
WHERE "qualified_name" IS NULL OR "language" IS NULL;

ALTER TABLE "code_symbols"
ALTER COLUMN "qualified_name" SET NOT NULL,
ALTER COLUMN "language" SET NOT NULL;

-- AlterTable
ALTER TABLE "chunks"
ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "symbol_relations" (
    "id" UUID NOT NULL,
    "repositoryId" UUID NOT NULL,
    "indexingRunId" UUID NOT NULL,
    "from_symbol_id" UUID NOT NULL,
    "to_symbol_id" UUID,
    "relation_type" "SymbolRelationType" NOT NULL,
    "target_qualified_name" TEXT,
    "target_file_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "symbol_relations_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "repository_files_run_path_key";

-- CreateIndex
CREATE UNIQUE INDEX "repository_files_repository_id_path_key" ON "repository_files"("repositoryId", "path");

-- CreateIndex
CREATE INDEX "code_symbols_qualified_name_idx" ON "code_symbols"("qualified_name");

-- CreateIndex
CREATE INDEX "code_symbols_parent_symbol_id_idx" ON "code_symbols"("parent_symbol_id");

-- CreateIndex
CREATE INDEX "symbol_relations_repository_run_idx" ON "symbol_relations"("repositoryId", "indexingRunId");

-- CreateIndex
CREATE INDEX "symbol_relations_from_symbol_idx" ON "symbol_relations"("from_symbol_id");

-- CreateIndex
CREATE INDEX "symbol_relations_to_symbol_idx" ON "symbol_relations"("to_symbol_id");

-- CreateIndex
CREATE INDEX "symbol_relations_relation_type_idx" ON "symbol_relations"("relation_type");

-- AddForeignKey
ALTER TABLE "code_symbols" ADD CONSTRAINT "code_symbols_parent_symbol_id_fkey" FOREIGN KEY ("parent_symbol_id") REFERENCES "code_symbols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_relations" ADD CONSTRAINT "symbol_relations_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_relations" ADD CONSTRAINT "symbol_relations_indexingRunId_fkey" FOREIGN KEY ("indexingRunId") REFERENCES "indexing_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_relations" ADD CONSTRAINT "symbol_relations_from_symbol_id_fkey" FOREIGN KEY ("from_symbol_id") REFERENCES "code_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_relations" ADD CONSTRAINT "symbol_relations_to_symbol_id_fkey" FOREIGN KEY ("to_symbol_id") REFERENCES "code_symbols"("id") ON DELETE SET NULL ON UPDATE CASCADE;
