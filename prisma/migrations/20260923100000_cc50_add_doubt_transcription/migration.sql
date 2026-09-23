-- CC-50: image-based doubt submission.
--
-- Provenance only. The transcription itself lands in the existing `description`
-- column, because an image-derived doubt IS a doubt: it must be searchable,
-- embeddable, answerable and moderatable through exactly the same paths as a
-- typed one. A separate table would have forced every read path to branch.
--
-- Both columns are additive and defaulted, so this is safe to apply to a table
-- with rows and safe to leave in place on a rollback.

-- Whether `description` was transcribed from a photograph rather than typed.
-- Defaults false, which is correct for every row that predates this migration.
ALTER TABLE "Doubt"
  ADD COLUMN "transcribedFromImage" BOOLEAN NOT NULL DEFAULT false;

-- Which vision model produced it. NULL for typed doubts. Mirrors the
-- `embeddingModel` column added by cc10: when output turns out to be wrong,
-- the first question is always which model produced it.
ALTER TABLE "Doubt"
  ADD COLUMN "transcriptionModel" TEXT;
