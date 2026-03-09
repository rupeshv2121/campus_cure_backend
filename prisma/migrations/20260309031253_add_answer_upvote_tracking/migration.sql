-- CreateTable
CREATE TABLE "AnswerUpvote" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upvotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerUpvote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerUpvote_userId_idx" ON "AnswerUpvote"("userId");

-- CreateIndex
CREATE INDEX "AnswerUpvote_answerId_idx" ON "AnswerUpvote"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerUpvote_answerId_userId_key" ON "AnswerUpvote"("answerId", "userId");

-- AddForeignKey
ALTER TABLE "AnswerUpvote" ADD CONSTRAINT "AnswerUpvote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerUpvote" ADD CONSTRAINT "AnswerUpvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
