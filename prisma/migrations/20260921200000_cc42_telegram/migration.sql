-- CC-42: a second notification channel over the same outbox.
--
-- Additive. Existing outbox rows default to EMAIL, so nothing already queued
-- changes behaviour.
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'TELEGRAM');

ALTER TABLE "EmailOutbox"
  ADD COLUMN "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL';

-- Set once the user has messaged the bot. Telegram will not let a bot message
-- someone who has not messaged it first, which makes opt-in structural.
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;
-- SHA-256 of the linking code, never the code itself.
ALTER TABLE "User" ADD COLUMN "telegramLinkHash" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramLinkExpiry" TIMESTAMP(3);

-- The drain claims by channel as well as status.
CREATE INDEX "EmailOutbox_channel_status_scheduledAt_idx"
  ON "EmailOutbox"("channel", "status", "scheduledAt");
