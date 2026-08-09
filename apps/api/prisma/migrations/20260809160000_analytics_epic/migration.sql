-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('REPOSITORY_CONNECTED', 'REPOSITORY_INDEXING_SUCCEEDED', 'REPOSITORY_INDEXING_FAILED');

-- CreateEnum
CREATE TYPE "AnswerFeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable
ALTER TABLE "repositories" ADD COLUMN "connected_by_user_id" UUID;

-- CreateIndex
CREATE INDEX "repositories_connected_by_user_id_idx" ON "repositories"("connected_by_user_id");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_connected_by_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
CREATE INDEX "messages_role_createdAt_idx" ON "messages"("role", "createdAt");

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "workspace_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "repository_id" UUID,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_type_created_at_idx" ON "analytics_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_workspace_id_created_at_idx" ON "analytics_events"("workspace_id", "created_at");

-- CreateTable
CREATE TABLE "message_source_citations" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "start_line" INTEGER,
    "end_line" INTEGER,
    "score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_source_citations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_source_citations_workspace_id_created_at_idx" ON "message_source_citations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "message_source_citations_repository_id_file_path_idx" ON "message_source_citations"("repository_id", "file_path");

-- CreateIndex
CREATE INDEX "message_source_citations_message_id_idx" ON "message_source_citations"("message_id");

-- AddForeignKey
ALTER TABLE "message_source_citations" ADD CONSTRAINT "message_source_citations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "answer_feedback" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" "AnswerFeedbackRating" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answer_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "answer_feedback_message_id_user_id_key" ON "answer_feedback"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "answer_feedback_workspace_id_created_at_idx" ON "answer_feedback"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill citations from existing assistant message metadata
INSERT INTO "message_source_citations" (
    "id",
    "message_id",
    "workspace_id",
    "repository_id",
    "chunk_id",
    "file_path",
    "start_line",
    "end_line",
    "score",
    "rank",
    "created_at"
)
SELECT
    gen_random_uuid(),
    m."id",
    c."workspaceId",
    (src.elem->>'repositoryId')::uuid,
    (src.elem->>'chunkId')::uuid,
    src.elem->>'filePath',
    NULLIF(src.elem->>'startLine', '')::integer,
    NULLIF(src.elem->>'endLine', '')::integer,
    COALESCE((src.elem->>'score')::double precision, 0),
    (src.ord - 1)::integer,
    m."createdAt"
FROM "messages" m
INNER JOIN "conversations" c ON c."id" = m."conversationId"
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(m."metadata"->'sources') = 'array' THEN m."metadata"->'sources'
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS src(elem, ord)
WHERE m."role" = 'ASSISTANT'
  AND src.elem->>'chunkId' IS NOT NULL
  AND src.elem->>'repositoryId' IS NOT NULL
  AND src.elem->>'filePath' IS NOT NULL;
