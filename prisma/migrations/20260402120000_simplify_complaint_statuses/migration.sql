-- Normalize existing complaint statuses before removing enum values
UPDATE "Complaint"
SET "status" = 'PENDING_CONFIRMATION'
WHERE "status" = 'PENDING_STUDENT_APPROVAL';

UPDATE "Complaint"
SET "status" = 'ESCALATED_TO_SUPERADMIN'
WHERE "status" IN ('REJECTED_BY_STUDENT', 'HANDLED_BY_SUPERADMIN');

UPDATE "Complaint"
SET "status" = 'RESOLVED'
WHERE "status" = 'CLOSED';

-- Recreate enum without redundant statuses
ALTER TABLE "Complaint" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "ComplaintStatus_new" AS ENUM (
  'RAISED',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_CONFIRMATION',
  'ESCALATED_TO_SUPERADMIN',
  'RESOLVED'
);

ALTER TABLE "Complaint"
ALTER COLUMN "status" TYPE "ComplaintStatus_new"
USING ("status"::text::"ComplaintStatus_new");

ALTER TYPE "ComplaintStatus" RENAME TO "ComplaintStatus_old";
ALTER TYPE "ComplaintStatus_new" RENAME TO "ComplaintStatus";
DROP TYPE "ComplaintStatus_old";

ALTER TABLE "Complaint" ALTER COLUMN "status" SET DEFAULT 'RAISED';
