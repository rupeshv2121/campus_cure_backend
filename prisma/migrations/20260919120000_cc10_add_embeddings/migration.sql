-- CC-10: embedding infrastructure
--
-- Hand-written because Prisma cannot express either the extension or an HNSW
-- index. See docs/specs/CC-10-embedding-infra.md.
--
-- Verified 2026-09-19 that the `postgres` role on this Supabase project can
-- create the extension despite not being a superuser (dry run inside a
-- rolled-back transaction). pgvector 0.8.0 on PostgreSQL 17.6.

CREATE EXTENSION IF NOT EXISTS vector;

-- 384 dimensions: sentence-transformers/all-MiniLM-L6-v2.
-- Changing the model requires a migration AND a full backfill; vectors from
-- different models are not comparable.
ALTER TABLE "Doubt" ADD COLUMN "embedding" vector(384);
ALTER TABLE "Doubt" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "Doubt" ADD COLUMN "embeddingVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Doubt" ADD COLUMN "embeddedAt" TIMESTAMP(3);

-- Cosine distance (<=>) to match the operator the repository queries with.
-- An HNSW index built with the wrong opclass is silently unused.
CREATE INDEX "doubt_embedding_hnsw"
  ON "Doubt" USING hnsw ("embedding" vector_cosine_ops);

CREATE TABLE "EmbeddingJob" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddingJob_pkey" PRIMARY KEY ("id")
);

-- One outstanding job per entity: makes enqueueing and the backfill idempotent.
CREATE UNIQUE INDEX "EmbeddingJob_entityType_entityId_key"
  ON "EmbeddingJob"("entityType", "entityId");

-- Drives the worker's claim query.
CREATE INDEX "EmbeddingJob_status_createdAt_idx"
  ON "EmbeddingJob"("status", "createdAt");
