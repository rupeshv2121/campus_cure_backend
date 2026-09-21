-- CC-21: private "save for later" on a doubt.
--
-- Mirrors DoubtUpvote exactly. Note the absence of any count column on Doubt:
-- a counter exists to be displayed, and displaying this one would make a
-- private action public.
CREATE TABLE "DoubtBookmark" (
    "id" TEXT NOT NULL,
    "doubtId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoubtBookmark_pkey" PRIMARY KEY ("id")
);

-- Makes the save/unsave toggle idempotent at the database level, whatever the
-- application does: a double-tap on bad campus wifi cannot create two rows.
CREATE UNIQUE INDEX "DoubtBookmark_doubtId_userId_key" ON "DoubtBookmark"("doubtId", "userId");
CREATE INDEX "DoubtBookmark_userId_idx" ON "DoubtBookmark"("userId");
CREATE INDEX "DoubtBookmark_doubtId_idx" ON "DoubtBookmark"("doubtId");

ALTER TABLE "DoubtBookmark" ADD CONSTRAINT "DoubtBookmark_doubtId_fkey"
  FOREIGN KEY ("doubtId") REFERENCES "Doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoubtBookmark" ADD CONSTRAINT "DoubtBookmark_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
