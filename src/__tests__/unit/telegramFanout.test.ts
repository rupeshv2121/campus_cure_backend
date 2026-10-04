/**
 * CC-42: queueing notifications to Telegram, independently of email.
 *
 * Telegram used to be queued inside the email path, so an email opt-out or a
 * missing Resend key silently stopped it. These tests pin the separation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const env = vi.hoisted(() => ({
  TELEGRAM_BOT_TOKEN: "123:abc" as string | undefined,
  TELEGRAM_BOT_USERNAME: "campuscure_bot" as string | undefined,
  TELEGRAM_WEBHOOK_SECRET: "s" as string | undefined,
  TELEGRAM_ENABLED: true,
  TELEGRAM_LINK_TTL_MINUTES: 15,
  FRONTEND_URL: "https://campus.example/" as string | undefined,
}));

const outbox = vi.hoisted(() => ({
  enqueueEmail: vi.fn(async (_input: Record<string, unknown>) => ({ queued: true })),
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => env);
vi.mock("../../services/email/outbox.js", () => outbox);

const { getTelegramStatus, queueNotificationTelegram } = await import(
  "../../services/notify/telegram.js"
);

const notification = {
  notificationId: "n-1",
  userId: "u-1",
  title: "Complaint assigned",
  message: "Your complaint about the fan in ML03 was assigned.",
};

beforeEach(() => {
  vi.clearAllMocks();
  env.TELEGRAM_ENABLED = true;
  env.FRONTEND_URL = "https://campus.example/";
});

describe("queueNotificationTelegram", () => {
  it("queues one message to the linked chat, with a link back to the app", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ telegramChatId: "777" });

    await expect(queueNotificationTelegram(notification)).resolves.toBe(true);

    const input = outbox.enqueueEmail.mock.calls[0]![0] as Record<string, string>;
    expect(input).toMatchObject({
      channel: "TELEGRAM",
      to: "777",
      subject: "Complaint assigned",
      dedupeKey: "notification:n-1:telegram",
    });
    // Trailing slash on FRONTEND_URL does not produce "//notifications".
    expect(input.text).toContain("https://campus.example/notifications/n-1");
    expect(input.text).toContain(notification.message);
  });

  it("does nothing for a user who has not linked Telegram", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ telegramChatId: null });
    await expect(queueNotificationTelegram(notification)).resolves.toBe(false);
    expect(outbox.enqueueEmail).not.toHaveBeenCalled();
  });

  it("does nothing, and reads nothing, when Telegram is not configured", async () => {
    env.TELEGRAM_ENABLED = false;
    await expect(queueNotificationTelegram(notification)).resolves.toBe(false);
    expect(db.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  /** The point of the change: nothing about email is consulted. */
  it("does not look at the email opt-out", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ telegramChatId: "777" });
    await queueNotificationTelegram(notification);

    const select = (db.prisma.user.findUnique.mock.calls[0]![0] as { select: object }).select;
    expect(select).toEqual({ telegramChatId: true });
  });

  it("never throws", async () => {
    db.prisma.user.findUnique.mockRejectedValue(new Error("db down"));
    await expect(queueNotificationTelegram(notification)).resolves.toBe(false);
  });
});

describe("getTelegramStatus", () => {
  it("reports linked and the bot to open", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ telegramChatId: "777" });
    await expect(getTelegramStatus("u-1")).resolves.toEqual({
      enabled: true,
      linked: true,
      botUsername: "campuscure_bot",
    });
  });

  it("names no bot when Telegram is off", async () => {
    env.TELEGRAM_ENABLED = false;
    db.prisma.user.findUnique.mockResolvedValue({ telegramChatId: null });
    await expect(getTelegramStatus("u-1")).resolves.toMatchObject({
      enabled: false,
      linked: false,
      botUsername: null,
    });
  });
});
