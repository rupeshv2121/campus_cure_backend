-- CC-23: mark which posts are HTML.
--
-- Additive and defaulted to TEXT, so every existing doubt and answer keeps
-- rendering through CC-22's plain-text path. Nothing is rewritten: converting
-- user-authored content to HTML would be a lossy, irreversible migration to
-- fix a problem nobody has.
CREATE TYPE "ContentFormat" AS ENUM ('TEXT', 'HTML');

ALTER TABLE "Doubt"
  ADD COLUMN "descriptionFormat" "ContentFormat" NOT NULL DEFAULT 'TEXT';

ALTER TABLE "Answer"
  ADD COLUMN "contentFormat" "ContentFormat" NOT NULL DEFAULT 'TEXT';
