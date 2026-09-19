-- CC-11: full-text search index for hybrid retrieval.
--
-- An expression index rather than a generated tsvector column: the text stays
-- in one place (title/description) with no denormalised copy to keep in sync.
--
-- The expression must match the query in searchRepository.ts EXACTLY, or
-- Postgres silently ignores the index and falls back to a sequential scan.
CREATE INDEX "doubt_fts_idx" ON "Doubt"
  USING gin (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("description", ''))
  );
