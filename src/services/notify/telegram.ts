/**
 * The Telegram provider (CC-42).
 *
 * Sibling of services/email/resend.ts, with the same shape and the same
 * permanent-vs-transient contract, so the outbox drain can dispatch to either
 * without knowing which it has.
 *
 * See docs/specs/CC-42-telegram.md.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../config/database.js";
import {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_ENABLED,
  TELEGRAM_LINK_TTL_MINUTES,
  TELEGRAM_WEBHOOK_SECRET,
} from "../../config/env.js";
import { PermanentEmailError } from "../email/resend.js";

const API = "https://api.telegram.org";

export interface TelegramMessage {
  chatId: string;
  text: string;
}

export interface TelegramSendResult {
  providerId: string;
}

/**
 * Send one message.
 *
 * Same error contract as Resend: a 4xx other than 429 is permanent and the
 * drain parks it immediately rather than burning five attempts. 403 is the
 * common one - "bot was blocked by the user" - and it also means the link is
 * dead, which the caller acts on.
 */
export const sendTelegram = async (
  message: TelegramMessage,
): Promise<TelegramSendResult> => {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new PermanentEmailError(
      "Telegram is not configured. Set TELEGRAM_BOT_TOKEN.",
    );
  }

  const response = await fetch(`${API}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: message.chatId,
      text: message.text,
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: { message_id?: number }; description?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    const detail = payload?.description ?? `HTTP ${response.status}`;

    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 429
    ) {
      throw new PermanentEmailError(detail);
    }

    throw new Error(detail);
  }

  return { providerId: String(payload.result?.message_id ?? "sent") };
};

/** True when the failure means this chat can never be messaged again. */
export const isDeadChat = (error: unknown): boolean => {
  const message = (error as Error)?.message?.toLowerCase() ?? "";

  return (
    message.includes("blocked by the user") ||
    message.includes("chat not found") ||
    message.includes("user is deactivated")
  );
};

const hashCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

export interface LinkOffer {
  code: string;
  deepLink: string;
  expiresInMinutes: number;
}

/**
 * Mint a linking code.
 *
 * Stored hashed, single-use and short-lived. An attacker who guesses a live
 * code can attach their own Telegram to somebody else's account and start
 * receiving that person's notifications, so this is a credential.
 */
export const createLinkCode = async (userId: string): Promise<LinkOffer> => {
  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MINUTES * 60_000);

  await prisma.user.update({
    where: { id: userId },
    data: { telegramLinkHash: hashCode(code), telegramLinkExpiry: expiresAt },
    select: { id: true },
  });

  const bot = TELEGRAM_BOT_USERNAME ?? "your_bot";

  return {
    code,
    deepLink: `https://t.me/${bot}?start=${code}`,
    expiresInMinutes: TELEGRAM_LINK_TTL_MINUTES,
  };
};

export interface RedeemResult {
  linked: boolean;
  reason?: string;
  userId?: string;
}

/**
 * Redeem a code against a chat id.
 *
 * Clears the code on success whatever happens next: it is single-use, so a
 * captured `/start` cannot be replayed to re-link a chat later.
 */
export const redeemLinkCode = async (
  code: string,
  chatId: string,
): Promise<RedeemResult> => {
  if (!code || !chatId) return { linked: false, reason: "missing" };

  const user = await prisma.user.findFirst({
    where: { telegramLinkHash: hashCode(code) },
    select: { id: true, telegramLinkExpiry: true },
  });

  if (!user) return { linked: false, reason: "unknown-code" };

  if (
    !user.telegramLinkExpiry ||
    user.telegramLinkExpiry.getTime() <= Date.now()
  ) {
    // Clear it so a stale code cannot linger as a target.
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramLinkHash: null, telegramLinkExpiry: null },
      select: { id: true },
    });
    return { linked: false, reason: "expired" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: String(chatId),
      telegramLinkHash: null,
      telegramLinkExpiry: null,
    },
    select: { id: true },
  });

  return { linked: true, userId: user.id };
};

export const unlinkTelegram = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramLinkHash: null,
      telegramLinkExpiry: null,
    },
    select: { id: true },
  });
};

/** Forget a chat that can never be messaged again. */
export const clearDeadChat = async (chatId: string): Promise<void> => {
  await prisma.user.updateMany({
    where: { telegramChatId: chatId },
    data: { telegramChatId: null },
  });
};

/**
 * Is this webhook request actually from Telegram?
 *
 * The webhook URL is public, so without this an attacker who guesses it can
 * forge a `/start <code>` from any chat id and link their own Telegram to
 * somebody else's account - turning a notification channel into a disclosure
 * channel.
 */
export const isAuthenticWebhook = (secretHeader: unknown): boolean => {
  if (!TELEGRAM_ENABLED || !TELEGRAM_WEBHOOK_SECRET) return false;

  return (
    typeof secretHeader === "string" &&
    secretHeader.length === TELEGRAM_WEBHOOK_SECRET.length &&
    secretHeader === TELEGRAM_WEBHOOK_SECRET
  );
};

/** Pull `/start <code>` out of an update, if that is what it is. */
export const parseStartCommand = (
  update: unknown,
): { chatId: string; code: string } | null => {
  const message = (update as { message?: { chat?: { id?: unknown }; text?: unknown } })
    ?.message;

  const chatId = message?.chat?.id;
  const text = message?.text;

  if (typeof text !== "string" || (typeof chatId !== "string" && typeof chatId !== "number")) {
    return null;
  }

  const match = /^\/start\s+(\S+)/.exec(text.trim());
  if (!match) return null;

  return { chatId: String(chatId), code: match[1] as string };
};
