-- CC-60: face login hardening.
--
-- Additive only. The plaintext "faceDescriptor" column is NOT dropped here:
-- src/scripts/encryptFaceDescriptors.ts needs to read it in order to write the
-- encrypted copy, and it needs the encryption key, which SQL does not have.
-- The script clears each row after migrating it. Drop the column in a later
-- migration once every row is confirmed empty.
ALTER TABLE "User" ADD COLUMN "faceDescriptorEnc" TEXT;

CREATE TABLE "FaceChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- SHA-256 of the nonce. A leaked table must not let anyone complete a
    -- pending challenge.
    "nonceHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FaceChallenge_nonceHash_key" ON "FaceChallenge"("nonceHash");
CREATE INDEX "FaceChallenge_userId_idx" ON "FaceChallenge"("userId");
-- Drives the cron cleanup of expired challenges.
CREATE INDEX "FaceChallenge_expiresAt_idx" ON "FaceChallenge"("expiresAt");

ALTER TABLE "FaceChallenge" ADD CONSTRAINT "FaceChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
