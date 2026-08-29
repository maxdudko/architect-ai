-- CreateEnum
CREATE TYPE "IndexingResourceMetric" AS ENUM (
  'REPOSITORY_SIZE_BYTES',
  'INDEXABLE_FILES',
  'INDEXED_TOKENS',
  'EMBEDDING_CHUNKS',
  'FILE_SIZE_BYTES'
);

-- CreateTable
CREATE TABLE "plan_indexing_limits" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "metric" "IndexingResourceMetric" NOT NULL,
    "max_value" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_indexing_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_indexing_limits_plan_id_metric_key" ON "plan_indexing_limits"("plan_id", "metric");

-- AddForeignKey
ALTER TABLE "plan_indexing_limits" ADD CONSTRAINT "plan_indexing_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Free: 250 MB / 10k files / 2M tokens / 15k chunks / 1 MB file
INSERT INTO "plan_indexing_limits" ("id", "plan_id", "metric", "max_value", "updated_at") VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'REPOSITORY_SIZE_BYTES', 262144000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'INDEXABLE_FILES', 10000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'INDEXED_TOKENS', 2000000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'EMBEDDING_CHUNKS', 15000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'FILE_SIZE_BYTES', 1048576, CURRENT_TIMESTAMP);

-- PRO: 1 GB / 50k files / 10M tokens / 50k chunks / 2 MB file
INSERT INTO "plan_indexing_limits" ("id", "plan_id", "metric", "max_value", "updated_at") VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'REPOSITORY_SIZE_BYTES', 1073741824, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'INDEXABLE_FILES', 50000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'INDEXED_TOKENS', 10000000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'EMBEDDING_CHUNKS', 50000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FILE_SIZE_BYTES', 2097152, CURRENT_TIMESTAMP);

-- Enterprise: same finite caps as PRO (admins can set max_value NULL for unlimited)
INSERT INTO "plan_indexing_limits" ("id", "plan_id", "metric", "max_value", "updated_at") VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'REPOSITORY_SIZE_BYTES', 1073741824, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'INDEXABLE_FILES', 50000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'INDEXED_TOKENS', 10000000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'EMBEDDING_CHUNKS', 50000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'FILE_SIZE_BYTES', 2097152, CURRENT_TIMESTAMP);
