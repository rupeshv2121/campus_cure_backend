/**
 * CC-41: web push.
 *
 * web-push itself is mocked: its encryption is its own, tested upstream. What
 * is ours is which subscriptions we accept, what a failure means, and that a
 * notification fans out once per device through the outbox.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    pushSubscription: {
      count: vi.fn(async () => 0),
      findUnique: vi.fn(),
      findMany: vi.fn(async () => [] as Array<{ id: string }>),
      upsert: vi.fn(async () => ({ id: "sub-1" })),
      update: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

const env = vi.hoisted(() => ({
  PUSH_ENABLED: true,
  PUSH_MAX_SUBSCRIPTIONS_PER_USER: 2,
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
  VAPID_SUBJECT: "https://example.test",
}));

const outbox = vi.hoisted(() => ({ enqueueEmail: vi.fn(async () => ({ queued: true })) }));

const webpush = vi.hoisted(() => {
  class WebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  }
  return {
    WebPushError,
    default: {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(async () => ({ statusCode: 201, headers: {} as Record<string, string> })),
    },
  };
});

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => env);
vi.mock("../../services/email/outbox.js", () => outbox);
vi.mock("web-push", () => webpush);

const {
  queueNotificationPush,
  removeSubscription,
  saveSubscription,
  sendPush,
} = await import("../../services/notify/push.js");
const { PermanentEmailError } = await import("../../services/email/resend.js");

const validSub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "BKey", auth: "auth" },
};

beforeEach(() => {
  vi.clearAllMocks();
  env.PUSH_ENABLED = true;
  db.prisma.pushSubscription.count.mockResolvedValue(0);
  db.prisma.pushSubscription.findUnique.mockResolvedValue(null);
});

describe("saveSubscription", () => {
  it("stores a valid subscription, keyed on the endpoint", async () => {
    await saveSubscription("u-1", validSub, "Firefox");
    const args = (db.prisma.pushSubscription.upsert.mock.calls[0] as unknown[])[0] as {
      where: unknown;
      create: Record<string, unknown>;
    };
    expect(args.where).toEqual({ endpoint: validSub.endpoint });
    expect(args.create).toMatchObject({ userId: "u-1", p256dh: "BKey", auth: "auth" });
  });

  /**
   * The drain POSTs to whatever endpoint is stored. A client-chosen http or
   * internal address would make this server a request-forgery proxy.
   */
  it("refuses non-https endpoints", async () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/x",
      "file:///etc/passwd",
      "not a url",
      "",
    ]) {
      await expect(
        saveSubscription("u-1", { ...validSub, endpoint }),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(db.prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it("refuses a subscription without its encryption keys", async () => {
    await expect(
      saveSubscription("u-1", { endpoint: validSub.endpoint, keys: {} }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("caps devices per user, but lets an existing device re-subscribe", async () => {
    db.prisma.pushSubscription.count.mockResolvedValue(2);
    await expect(saveSubscription("u-1", validSub)).rejects.toMatchObject({ status: 409 });

    db.prisma.pushSubscription.findUnique.mockResolvedValue({ userId: "u-1" });
    await expect(saveSubscription("u-1", validSub)).resolves.toBeTruthy();
  });

  it("answers 503 when push is not configured", async () => {
    env.PUSH_ENABLED = false;
    await expect(saveSubscription("u-1", validSub)).rejects.toMatchObject({ status: 503 });
  });
});

describe("removeSubscription", () => {
  it("only ever deletes the caller's own subscription", async () => {
    await removeSubscription("u-1", validSub.endpoint);
    expect(db.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u-1", endpoint: validSub.endpoint },
    });
  });
});

describe("queueNotificationPush", () => {
  it("queues one push per device, with a per-device dedupe key", async () => {
    db.prisma.pushSubscription.findMany.mockResolvedValue([{ id: "d1" }, { id: "d2" }]);

    const queued = await queueNotificationPush({
      notificationId: "n-1",
      userId: "u-1",
      type: "COMPLAINT_ASSIGNED" as never,
      title: "Assigned",
      message: "x".repeat(1000),
    });

    expect(queued).toBe(2);
    const calls = outbox.enqueueEmail.mock.calls.map((c) => (c as unknown[])[0]) as Array<{
      channel: string;
      to: string;
      text: string;
      dedupeKey: string;
    }>;
    expect(calls.map((c) => [c.channel, c.to, c.dedupeKey])).toEqual([
      ["PUSH", "d1", "notification:n-1:push:d1"],
      ["PUSH", "d2", "notification:n-1:push:d2"],
    ]);
    // Push payloads cap at about 4 KB; the body is trimmed well under that.
    const payload = JSON.parse(calls[0]!.text) as { body: string; notificationId: string };
    expect(payload.body.length).toBeLessThanOrEqual(300);
    expect(payload.notificationId).toBe("n-1");
  });

  it("never throws", async () => {
    db.prisma.pushSubscription.findMany.mockRejectedValue(new Error("db down"));
    await expect(
      queueNotificationPush({
        notificationId: "n",
        userId: "u",
        type: "COMPLAINT_ASSIGNED" as never,
        title: "t",
        message: "m",
      }),
    ).resolves.toBe(0);
  });
});

describe("sendPush", () => {
  const device = { id: "d1", endpoint: validSub.endpoint, p256dh: "k", auth: "a" };

  it("delivers and records the success", async () => {
    db.prisma.pushSubscription.findUnique.mockResolvedValue(device);
    await sendPush("d1", "{}");

    expect(webpush.default.sendNotification).toHaveBeenCalled();
    expect(db.prisma.pushSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" } }),
    );
  });

  /** 404/410: the user revoked permission. Retrying is pointless; the row goes. */
  it("deletes a gone subscription and fails permanently", async () => {
    db.prisma.pushSubscription.findUnique.mockResolvedValue(device);
    webpush.default.sendNotification.mockRejectedValueOnce(
      new webpush.WebPushError("gone", 410),
    );

    await expect(sendPush("d1", "{}")).rejects.toBeInstanceOf(PermanentEmailError);
    expect(db.prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: "d1" },
    });
  });

  it("treats a 4xx as permanent and a 5xx as retryable", async () => {
    db.prisma.pushSubscription.findUnique.mockResolvedValue(device);
    webpush.default.sendNotification.mockRejectedValueOnce(
      new webpush.WebPushError("bad", 400),
    );
    await expect(sendPush("d1", "{}")).rejects.toBeInstanceOf(PermanentEmailError);

    webpush.default.sendNotification.mockRejectedValueOnce(
      new webpush.WebPushError("down", 503),
    );
    const error = await sendPush("d1", "{}").catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(PermanentEmailError);
  });

  it("fails permanently for a subscription removed after queueing", async () => {
    db.prisma.pushSubscription.findUnique.mockResolvedValue(null);
    await expect(sendPush("gone", "{}")).rejects.toBeInstanceOf(PermanentEmailError);
  });
});
