/**
 * CC-42: the Telegram channel.
 *
 * The webhook secret is the security-critical part. The URL is public, so
 * without that check anyone who guesses it can forge a "/start <code>" from
 * their own chat id and attach their Telegram to somebody else's account —
 * turning a notification channel into a disclosure channel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    user: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

const env = vi.hoisted(() => ({
  TELEGRAM_BOT_TOKEN: "123:abc" as string | undefined,
  TELEGRAM_BOT_USERNAME: "campuscure_bot" as string | undefined,
  TELEGRAM_WEBHOOK_SECRET: "s3cret-token" as string | undefined,
  TELEGRAM_ENABLED: true,
  TELEGRAM_LINK_TTL_MINUTES: 15,
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => env);

import { PermanentEmailError } from "../../services/email/resend.js";
import {
  clearDeadChat,
  createLinkCode,
  isAuthenticWebhook,
  isDeadChat,
  parseStartCommand,
  redeemLinkCode,
  sendTelegram,
  unlinkTelegram,
} from "../../services/notify/telegram.js";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const fail = (status: number, body: unknown) =>
  ({ ok: false, status, json: async () => body }) as Response;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const argOf = (fn: { mock: { calls: any[][] } }, call = 0): any =>
  fn.mock.calls[call]![0];

beforeEach(() => {
  vi.clearAllMocks();
  env.TELEGRAM_ENABLED = true;
  env.TELEGRAM_BOT_TOKEN = "123:abc";
  env.TELEGRAM_WEBHOOK_SECRET = "s3cret-token";
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  db.prisma.user.update.mockResolvedValue({});
  db.prisma.user.updateMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("sendTelegram", () => {
  it("posts to the bot API and returns the message id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ ok: true, result: { message_id: 42 } }));

    await expect(
      sendTelegram({ chatId: "555", text: "hello" }),
    ).resolves.toEqual({ providerId: "42" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/bot123:abc/sendMessage");
    expect(JSON.parse(init.body).chat_id).toBe("555");
  });

  it("treats a 4xx as permanent, so it is not retried", async () => {
    fetchMock.mockResolvedValueOnce(
      fail(403, { ok: false, description: "bot was blocked by the user" }),
    );

    await expect(sendTelegram({ chatId: "555", text: "x" })).rejects.toBeInstanceOf(
      PermanentEmailError,
    );
  });

  it("treats 429 as transient, because rate limits pass", async () => {
    fetchMock.mockResolvedValueOnce(
      fail(429, { ok: false, description: "Too Many Requests" }),
    );

    const error = await sendTelegram({ chatId: "5", text: "x" }).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PermanentEmailError);
  });

  it("treats a 5xx as transient", async () => {
    fetchMock.mockResolvedValueOnce(fail(502, { ok: false }));

    const error = await sendTelegram({ chatId: "5", text: "x" }).catch((e) => e);
    expect(error).not.toBeInstanceOf(PermanentEmailError);
  });

  it("treats ok:false as a failure even on HTTP 200", async () => {
    fetchMock.mockResolvedValueOnce(ok({ ok: false, description: "nope" }));

    await expect(sendTelegram({ chatId: "5", text: "x" })).rejects.toThrow();
  });

  it("refuses to pretend it sent anything with no token", async () => {
    env.TELEGRAM_BOT_TOKEN = undefined;

    await expect(
      sendTelegram({ chatId: "5", text: "x" }),
    ).rejects.toBeInstanceOf(PermanentEmailError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("isDeadChat", () => {
  it("recognises the failures that mean the link is gone", () => {
    expect(isDeadChat(new Error("Forbidden: bot was blocked by the user"))).toBe(
      true,
    );
    expect(isDeadChat(new Error("Bad Request: chat not found"))).toBe(true);
    expect(isDeadChat(new Error("Forbidden: user is deactivated"))).toBe(true);
  });

  it("does not treat a rate limit as a dead chat", () => {
    expect(isDeadChat(new Error("Too Many Requests"))).toBe(false);
  });
});

describe("linking", () => {
  it("stores the code hashed, never in plaintext", async () => {
    const offer = await createLinkCode("u-1");

    const stored = argOf(db.prisma.user.update).data;
    expect(stored.telegramLinkHash).not.toBe(offer.code);
    expect(stored.telegramLinkHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("builds a deep link the user can tap", async () => {
    const offer = await createLinkCode("u-1");

    expect(offer.deepLink).toBe(
      `https://t.me/campuscure_bot?start=${offer.code}`,
    );
  });

  it("sets an expiry in the future", async () => {
    await createLinkCode("u-1");

    expect(
      argOf(db.prisma.user.update).data.telegramLinkExpiry.getTime(),
    ).toBeGreaterThan(Date.now());
  });

  it("gives a different code every time", async () => {
    const a = await createLinkCode("u-1");
    const b = await createLinkCode("u-1");

    expect(a.code).not.toBe(b.code);
  });

  it("links the chat id for a valid code", async () => {
    db.prisma.user.findFirst.mockResolvedValueOnce({
      id: "u-1",
      telegramLinkExpiry: new Date(Date.now() + 60_000),
    });

    await expect(redeemLinkCode("good", "555")).resolves.toEqual({
      linked: true,
      userId: "u-1",
    });
    expect(argOf(db.prisma.user.update).data.telegramChatId).toBe("555");
  });

  it("clears the code on redemption, so it is single use", async () => {
    db.prisma.user.findFirst.mockResolvedValueOnce({
      id: "u-1",
      telegramLinkExpiry: new Date(Date.now() + 60_000),
    });

    await redeemLinkCode("good", "555");

    expect(argOf(db.prisma.user.update).data.telegramLinkHash).toBeNull();
  });

  it("rejects an expired code and clears it", async () => {
    db.prisma.user.findFirst.mockResolvedValueOnce({
      id: "u-1",
      telegramLinkExpiry: new Date(Date.now() - 1000),
    });

    await expect(redeemLinkCode("stale", "555")).resolves.toMatchObject({
      linked: false,
      reason: "expired",
    });
    expect(argOf(db.prisma.user.update).data.telegramChatId).toBeUndefined();
  });

  it("rejects an unknown code without touching anything", async () => {
    db.prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(redeemLinkCode("nope", "555")).resolves.toMatchObject({
      linked: false,
      reason: "unknown-code",
    });
    expect(db.prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a missing code or chat id without querying", async () => {
    await expect(redeemLinkCode("", "555")).resolves.toMatchObject({
      linked: false,
    });
    await expect(redeemLinkCode("x", "")).resolves.toMatchObject({
      linked: false,
    });
    expect(db.prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("unlinking clears everything", async () => {
    await unlinkTelegram("u-1");

    expect(argOf(db.prisma.user.update).data).toEqual({
      telegramChatId: null,
      telegramLinkHash: null,
      telegramLinkExpiry: null,
    });
  });

  it("forgets a dead chat", async () => {
    await clearDeadChat("555");

    expect(argOf(db.prisma.user.updateMany).where).toEqual({
      telegramChatId: "555",
    });
  });
});

describe("isAuthenticWebhook", () => {
  it("accepts the configured secret", () => {
    expect(isAuthenticWebhook("s3cret-token")).toBe(true);
  });

  it("rejects a wrong, missing or non-string secret", () => {
    // Without this, a forged /start links an attacker's chat to someone else.
    expect(isAuthenticWebhook("wrong-token!")).toBe(false);
    expect(isAuthenticWebhook(undefined)).toBe(false);
    expect(isAuthenticWebhook("")).toBe(false);
    expect(isAuthenticWebhook(12345)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    env.TELEGRAM_WEBHOOK_SECRET = undefined;

    expect(isAuthenticWebhook("anything")).toBe(false);
  });

  it("rejects everything when the channel is off", () => {
    env.TELEGRAM_ENABLED = false;

    expect(isAuthenticWebhook("s3cret-token")).toBe(false);
  });
});

describe("parseStartCommand", () => {
  const update = (text: unknown, chatId: unknown = 555) => ({
    message: { chat: { id: chatId }, text },
  });

  it("extracts the chat id and code", () => {
    expect(parseStartCommand(update("/start abc123"))).toEqual({
      chatId: "555",
      code: "abc123",
    });
  });

  it("accepts a numeric or string chat id", () => {
    expect(parseStartCommand(update("/start x", "777"))?.chatId).toBe("777");
  });

  it("ignores anything that is not a link attempt", () => {
    // Stickers, group joins, /start with no code - acknowledged and ignored.
    expect(parseStartCommand(update("hello"))).toBeNull();
    expect(parseStartCommand(update("/start"))).toBeNull();
    expect(parseStartCommand(update(undefined))).toBeNull();
    expect(parseStartCommand({})).toBeNull();
    expect(parseStartCommand(null)).toBeNull();
  });
});
