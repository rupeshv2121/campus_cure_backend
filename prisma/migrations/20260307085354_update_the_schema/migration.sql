-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "editHistory" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Doubt" ADD COLUMN     "editHistory" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "totalActiveComplaints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalComplaints" INTEGER NOT NULL DEFAULT 0;
