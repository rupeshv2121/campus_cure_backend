-- CC-11: ensure the HNSW vector index exists.
--
-- The index created by 20260919120000_cc10_add_embeddings was verified present
-- immediately after that migration applied, but was absent a short time later.
-- The cause was not established: the migration is recorded as finished, the
-- embedding columns and all 7 vectors survived, and EmbeddingJob's unique index
-- (created by a LATER statement in the same file) exists — so the CREATE INDEX
-- did run.
--
-- Rather than guess, this migration is idempotent and self-healing. Without the
-- index, cosine search falls back to a sequential scan: correct, but it degrades
-- badly as the corpus grows, and silently.
--
-- If this recurs, check whether the platform reclaims HNSW indexes under
-- maintenance_work_mem pressure on the free tier.
CREATE INDEX IF NOT EXISTS "doubt_embedding_hnsw"
  ON "Doubt" USING hnsw ("embedding" vector_cosine_ops);
