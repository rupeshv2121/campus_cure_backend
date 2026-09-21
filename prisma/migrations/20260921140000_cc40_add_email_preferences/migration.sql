-- CC-40: per-user email notification preference and unsubscribe token.
--
-- Additive: one defaulted column and one nullable column. Existing rows get
-- emailNotifications = true, which is correct - everything sent is
-- transactional, about the recipient's own complaint or their own doubt.
ALTER TABLE "User" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- Nullable and minted on first use, so no backfill is needed. NOT derived from
-- the user id: this token travels in clear text through mail servers, logs and
-- forwarded messages.
ALTER TABLE "User" ADD COLUMN "unsubscribeToken" TEXT;

CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");
