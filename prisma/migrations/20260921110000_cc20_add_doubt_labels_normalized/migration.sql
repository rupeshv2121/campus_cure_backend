-- CC-20: a derived, canonical form of Doubt.labels for filtering.
--
-- NOTHING IS OVERWRITTEN. The obvious implementation lowercases "labels" in
-- place and indexes it, which destroys what the author typed and cannot be
-- undone. This adds a second column instead, so "labels" stays byte-identical,
-- the backfill below is re-runnable, and rollback is a dropped column rather
-- than lost data.
ALTER TABLE "Doubt" ADD COLUMN "labelsNormalized" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill existing rows.
--
-- Mirrors normalizeTag() in src/utils/tags.ts: lowercase, trim, collapse
-- internal whitespace to "-", strip anything outside [a-z0-9-+#.].
--
-- TWO THINGS HERE ARE DELIBERATE AND EASY TO GET WRONG:
--
-- 1. POSIX classes ([[:space:]]), never "\s". A backslash escape in this path
--    is fragile - depending on how the statement is constructed it can be
--    consumed before Postgres sees it, at which point the pattern silently
--    becomes "s+" and every tag containing the letter s is corrupted
--    ("Sorting" -> "-orting"). POSIX classes contain no backslash, so they
--    cannot be eaten.
--
-- 2. WITH ORDINALITY and no DISTINCT, so the result is the same length and
--    order as "labels". The frontend reads labelsNormalized[i] as the lookup
--    key for labels[i]; array_agg(DISTINCT ...) re-sorts and dedupes, which
--    would silently pair a tag with another tag's canonical casing.
--
-- A label that normalizes to nothing (e.g. "!!!") is kept as an empty string
-- rather than dropped, again to hold alignment. Nothing filters on "", and
-- buildVocabulary() skips it. New writes drop such a label from both columns,
-- which they can do because they control both.
UPDATE "Doubt" d
SET "labelsNormalized" = COALESCE((
  SELECT array_agg(
           regexp_replace(
             regexp_replace(lower(btrim(label)), '[[:space:]]+', '-', 'g'),
             '[^a-z0-9+#.-]', '', 'g'
           )
           ORDER BY ord
         )
  FROM unnest(d."labels") WITH ORDINALITY AS t(label, ord)
), ARRAY[]::TEXT[])
WHERE array_length(d."labels", 1) IS NOT NULL;

-- GIN supports the array-containment operator the tag filter uses. Without it
-- `hasEvery` degrades to a sequential scan.
CREATE INDEX "Doubt_labelsNormalized_idx" ON "Doubt" USING GIN ("labelsNormalized");
