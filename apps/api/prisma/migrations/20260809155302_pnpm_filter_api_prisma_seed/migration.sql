-- AlterTable
ALTER TABLE "code_symbols" ALTER COLUMN "start_column" DROP DEFAULT,
ALTER COLUMN "end_column" DROP DEFAULT;

-- AlterTable
ALTER TABLE "repository_files" ALTER COLUMN "size" DROP DEFAULT,
ALTER COLUMN "line_count" DROP DEFAULT,
ALTER COLUMN "extension" DROP DEFAULT;
