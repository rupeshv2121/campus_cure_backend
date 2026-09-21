/**
 * Telegram linking and the bot webhook (CC-42).
 *
 * See docs/specs/CC-42-telegram.md.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { TELEGRAM_ENABLED } from "../config/env.js";
import { authenticate } from "../middleware/auth.js";
import {
  createLinkCode,
  isAuthenticWebhook,
  parseStartCommand,
  redeemLinkCode,
  sendTelegram,
  unlinkTelegram,
} from "../services/notify/telegram.js";
import type { AuthRequest } from "../types/index.js";

/** Authenticated, per-user linking. Mounted under /api/me. */
export const telegramLinkRouter = Router();

/** Public, called by Telegram. Mounted under /api/telegram. */
export const telegramWebhookRouter = Router();

telegramLinkRouter.get(
  "/telegram/link",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!TELEGRAM_ENABLED) {
        res.status(503).json({ error: "Telegram is not configured." });
        return;
      }

      res.json(await createLinkCode(req.user!.id));
    } catch (error) {
      console.error("[CC-42] link code failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

telegramLinkRouter.delete(
  "/telegram/link",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      await unlinkTelegram(req.user!.id);
      res.json({ message: "Telegram unlinked." });
    } catch (error) {
      console.error("[CC-42] unlink failed:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * Telegram delivers updates here.
 *
 * ALWAYS ANSWERS 200 once authenticated. Telegram retries a non-2xx and will
 * eventually disable a webhook that keeps failing, so an unparseable update -
 * a sticker, a group join - must not look like an outage.
 */
telegramWebhookRouter.post("/webhook", async (req: Request, res: Response) => {
  // 404 rather than 503 when disabled: an unconfigured webhook should not
  // advertise that it exists.
  if (!TELEGRAM_ENABLED) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!isAuthenticWebhook(req.headers["x-telegram-bot-api-secret-token"])) {
    // The URL is public. Without this check a forged /start links an
    // attacker's chat to somebody else's account.
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const start = parseStartCommand(req.body);

    // Anything that is not a link attempt is acknowledged and ignored.
    if (!start) {
      res.json({ ok: true });
      return;
    }

    const result = await redeemLinkCode(start.code, start.chatId);

    await sendTelegram({
      chatId: start.chatId,
      text: result.linked
        ? "CampusCure is linked. You will get your notifications here."
        : "That link code is not valid or has expired. Open CampusCure and generate a new one.",
    }).catch((error) => {
      console.error("[CC-42] reply failed:", (error as Error).message);
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[CC-42] webhook failed:", error);
    // Still 200: Telegram disables webhooks that keep erroring.
    res.json({ ok: true });
  }
});
