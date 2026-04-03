-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "assignmentHistory" JSONB NOT NULL DEFAULT '[]';
