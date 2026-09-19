-- CC-13: duplicate complaint detection.
--
-- Mirrors the Doubt columns from 20260919120000_cc10_add_embeddings. The
-- per-row model tag is what makes an embedding-model change a detectable
-- backfill rather than silent index corruption.
ALTER TABLE "Complaint" ADD COLUMN "embedding" vector(384);
ALTER TABLE "Complaint" ADD COLUMN "embeddingModel" TEXT;
ALTER TABLE "Complaint" ADD COLUMN "embeddingVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Complaint" ADD COLUMN "embeddedAt" TIMESTAMP(3);

-- vector_cosine_ops must match the <=> operator used by the repository, or the
-- index is silently ignored.
CREATE INDEX IF NOT EXISTS "complaint_embedding_hnsw"
  ON "Complaint" USING hnsw ("embedding" vector_cosine_ops);
