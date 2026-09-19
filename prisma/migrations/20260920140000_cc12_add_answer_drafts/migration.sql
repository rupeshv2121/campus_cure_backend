-- CC-12: retrieval-grounded AI answer drafts.
--
-- Drafts live in their own table, not in "Answer", so they are structurally
-- incapable of reaching a student: no student-facing query touches this table.
-- Approval creates a real Answer authored by the reviewing faculty member.

ALTER TABLE "Answer" ADD COLUMN "aiAssisted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AnswerDraft" (
    "id" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "editedOnApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerDraft_pkey" PRIMARY KEY ("id")
);

-- One outstanding draft per doubt: makes generation idempotent.
CREATE UNIQUE INDEX "AnswerDraft_doubtId_key" ON "AnswerDraft"("doubtId");
CREATE INDEX "AnswerDraft_status_createdAt_idx" ON "AnswerDraft"("status", "createdAt");
