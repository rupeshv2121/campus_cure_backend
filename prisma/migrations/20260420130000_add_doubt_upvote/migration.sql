-- Create table for per-user doubt upvotes
CREATE TABLE "DoubtUpvote" (
    "id" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upvotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtUpvote_pkey" PRIMARY KEY ("id")
);

-- Ensure one upvote per user per doubt
CREATE UNIQUE INDEX "DoubtUpvote_doubtId_userId_key" ON "DoubtUpvote"("doubtId", "userId");
CREATE INDEX "DoubtUpvote_userId_idx" ON "DoubtUpvote"("userId");
CREATE INDEX "DoubtUpvote_doubtId_idx" ON "DoubtUpvote"("doubtId");

-- Cascade deletes when doubt or user is removed
ALTER TABLE "DoubtUpvote"
ADD CONSTRAINT "DoubtUpvote_doubtId_fkey"
FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoubtUpvote"
ADD CONSTRAINT "DoubtUpvote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
