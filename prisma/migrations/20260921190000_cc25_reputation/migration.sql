-- CC-25: reputation ledger and denormalised total.
--
-- Additive. Existing content is deliberately NOT scored: a leaderboard decided
-- by who posted before the feature existed ranks history, and reputation is
-- meant to motivate future behaviour. Everyone starts at zero on the same day.
ALTER TABLE "User" ADD COLUMN "reputation" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- The anti-gaming control, enforced by the database rather than by the
-- application remembering to check. One actor, one source, one award.
CREATE UNIQUE INDEX "ReputationEvent_userId_reason_sourceType_sourceId_actorId_key"
  ON "ReputationEvent"("userId", "reason", "sourceType", "sourceId", "actorId");

CREATE INDEX "ReputationEvent_userId_createdAt_idx"
  ON "ReputationEvent"("userId", "createdAt");

ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drives the leaderboard.
CREATE INDEX "User_reputation_idx" ON "User"("reputation" DESC);
