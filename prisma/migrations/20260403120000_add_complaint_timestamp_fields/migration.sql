-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "pendingConfirmationAt" TIMESTAMP(3);
