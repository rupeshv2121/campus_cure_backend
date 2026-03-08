-- CreateTable
CREATE TABLE "DoubtView" (
    "id" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoubtView_doubtId_userId_key" ON "DoubtView"("doubtId", "userId");

-- CreateIndex
CREATE INDEX "DoubtView_userId_idx" ON "DoubtView"("userId");

-- CreateIndex
CREATE INDEX "DoubtView_doubtId_idx" ON "DoubtView"("doubtId");

-- AddForeignKey
ALTER TABLE "DoubtView" ADD CONSTRAINT "DoubtView_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoubtView" ADD CONSTRAINT "DoubtView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
