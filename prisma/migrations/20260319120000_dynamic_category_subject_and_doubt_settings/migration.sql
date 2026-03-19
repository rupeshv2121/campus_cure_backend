-- Preserve existing data while moving enum-backed columns to text for runtime-configurable values.
ALTER TABLE "Complaint"
  ALTER COLUMN "category" TYPE TEXT
  USING "category"::text;

ALTER TABLE "Doubt"
  ALTER COLUMN "subject" TYPE TEXT
  USING "subject"::text;

ALTER TABLE "AdminProfile"
  ADD COLUMN "doubtSubjects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Remove now-unused enum types after column conversions.
DROP TYPE IF EXISTS "ComplaintCategory";
DROP TYPE IF EXISTS "Subject";
