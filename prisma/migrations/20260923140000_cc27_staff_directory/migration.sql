-- CC-27: staff directory and routable non-teaching staff.
--
-- All four columns are additive and defaulted, so this is safe on a table with
-- rows. Existing faculty keep isTeaching = true, gain no categories (so they
-- are not offered as routing targets for maintenance faults), and are absent
-- from the directory until they opt in.

-- Display label: "Electrician", "Plumber", "Lab Assistant". Free text, because
-- a college's job titles are not ours to enumerate.
ALTER TABLE "FacultyProfile" ADD COLUMN "staffRole" TEXT;

-- The routing field. CC-14 category names, so intake and routing cannot drift.
-- Empty is the correct default for a lecturer: absence of a claim.
ALTER TABLE "FacultyProfile"
  ADD COLUMN "handlesCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Opt-in. Off by default: consent is what separates a staff directory from the
-- student people-finder the roadmap cut as a harassment vector.
ALTER TABLE "FacultyProfile"
  ADD COLUMN "directoryOptIn" BOOLEAN NOT NULL DEFAULT false;

-- GIN, because every routing query is a containment test ("who handles FAN?")
-- over an array column. A btree index cannot answer that.
CREATE INDEX "FacultyProfile_handlesCategories_idx"
  ON "FacultyProfile" USING GIN ("handlesCategories");
