-- AlterTable
ALTER TABLE "Doubt" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Doubt" ADD COLUMN     "moderatedById" TEXT;
ALTER TABLE "Doubt" ADD COLUMN     "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Doubt" ADD COLUMN     "moderationNote" TEXT;
ALTER TABLE "Doubt" ADD COLUMN     "moderationHistory" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "Doubt_approvalStatus_idx" ON "Doubt"("approvalStatus");
CREATE INDEX "Doubt_moderatedById_idx" ON "Doubt"("moderatedById");

-- AddForeignKey
ALTER TABLE "Doubt" ADD CONSTRAINT "Doubt_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
