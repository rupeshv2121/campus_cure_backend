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
-- Must match normalizeTag() in src/utils/tags.ts: lowercase, trim, collapse
-- internal whitespace to "-", strip anything outside [a-z0-9-+#.]. If the two
-- ever diverge, re-run `npx tsx src/scripts/normalizeDoubtLabels.ts`, which is
-- authoritative and idempotent.
UPDATE "Doubt"
SET "labelsNormalized" = COALESCE((
  SELECT array_agg(DISTINCT n)
  FROM (
    SELECT regexp_replace(
             regexp_replace(lower(btrim(label)), '\s+', '-', 'g'),
             '[^a-z0-9\-+#.]', '', 'g'
           ) AS n
    FROM unnest("labels") AS label
  ) cleaned
  WHERE n <> ''
), ARRAY[]::TEXT[])
WHERE array_length("labels", 1) IS NOT NULL;

-- GIN supports the array-containment operator the tag filter uses. Without it
-- `hasEvery` degrades to a sequential scan.
CREATE INDEX "Doubt_labelsNormalized_idx" ON "Doubt" USING GIN ("labelsNormalized");
