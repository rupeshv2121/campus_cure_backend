-- AlterEnum
ALTER TYPE "ComplaintStatus" ADD VALUE 'PENDING_CONFIRMATION';

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN "resolutionDate" TIMESTAMP(3),
ADD COLUMN "studentConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "studentConfirmationDate" TIMESTAMP(3);