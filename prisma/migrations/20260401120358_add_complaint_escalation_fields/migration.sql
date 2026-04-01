-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ComplaintStatus" ADD VALUE 'PENDING_STUDENT_APPROVAL';
ALTER TYPE "ComplaintStatus" ADD VALUE 'REJECTED_BY_STUDENT';
ALTER TYPE "ComplaintStatus" ADD VALUE 'ESCALATED_TO_SUPERADMIN';
ALTER TYPE "ComplaintStatus" ADD VALUE 'HANDLED_BY_SUPERADMIN';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "escalationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "handledBySuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectionHistory" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "studentRejectionMessage" TEXT,
ADD COLUMN     "superAdminId" TEXT;
