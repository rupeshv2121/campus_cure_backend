/**
 * CC-40: the email channel over the Notification model.
 *
 * The invariant that matters most is that email is strictly additive — a mail
 * problem must never damage the in-app notification that caused it. After that
 * it is the policy: which types are worth an email, and who has said no.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

const outbox = vi.hoisted(() => ({
  enqueueEmail: vi.fn(),
  triggerEmailDrainInBackground: vi.fn(),
}));

const envMock = vi.hoisted(() => ({
  NOTIFICATION_EMAILS_ENABLED: true,
  FRONTEND_URL: "https://app.example.edu",
  PUBLIC_API_URL: "https://api.example.edu",
}));

vi.mock("../../config/database.js", () => db);
vi.mock("./../../services/email/outbox.js", () => outbox);
vi.mock("../../config/env.js", () => envMock);

import {
  EMAILS_BY_TYPE,
  queueNotificationEmail,
  unsubscribeByToken,
} from "../../services/email/notificationEmail.js";
import { renderNotificationEmail } from "../../services/email/templates.js";

const request = (over: Record<string, unknown> = {}) => ({
  notificationId: "notif-1",
  userId: "user-1",
  type: "DOUBT_ANSWER" as const,
  title: "New Answer to Your Doubt",
  message: 'Asha answered your doubt: "Why is my loop infinite?"',
  data: { doubtId: "doubt-9" },
  ...over,
});

const user = (over: Record<string, unknown> = {}) => ({
  email: "student@example.edu",
  name: "Ravi Kumar",
  emailNotifications: true,
  unsubscribeToken: "tok-abc",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  envMock.NOTIFICATION_EMAILS_ENABLED = true;
  db.prisma.user.findUnique.mockResolvedValue(user());
  db.prisma.user.update.mockResolvedValue({});
  outbox.enqueueEmail.mockResolvedValue({ queued: true, id: "mail-1" });
});

describe("type policy", () => {
  it("emails the types that need action", () => {
    expect(EMAILS_BY_TYPE.COMPLAINT_STATUS_UPDATE).toBe(true);
    expect(EMAILS_BY_TYPE.COMPLAINT_ASSIGNED).toBe(true);
    expect(EMAILS_BY_TYPE.DOUBT_ANSWER).toBe(true);
    expect(EMAILS_BY_TYPE.DOUBT_ACCEPTED).toBe(true);
  });

  it("does not email the noisy ones", () => {
    // Mailing every upvote is how a product teaches people to filter it.
    expect(EMAILS_BY_TYPE.ANSWER_UPVOTED).toBe(false);
    expect(EMAILS_BY_TYPE.GENERAL).toBe(false);
  });
});

describe("queueNotificationEmail", () => {
  it("queues one email for an eligible type", async () => {
    await expect(queueNotificationEmail(request())).resolves.toEqual({
      sent: true,
    });
    expect(outbox.enqueueEmail).toHaveBeenCalledOnce();
  });

  it("queues nothing for a suppressed type", async () => {
    const result = await queueNotificationEmail(
      request({ type: "ANSWER_UPVOTED" }),
    );

    expect(result).toEqual({ sent: false, reason: "type-suppressed" });
    expect(outbox.enqueueEmail).not.toHaveBeenCalled();
  });

  it("lets an explicit false suppress an eligible type", async () => {
    const result = await queueNotificationEmail(request({ email: false }));

    expect(result.sent).toBe(false);
    expect(outbox.enqueueEmail).not.toHaveBeenCalled();
  });

  it("lets an explicit true send a suppressed type", async () => {
    await queueNotificationEmail(
      request({ type: "ANSWER_UPVOTED", email: true }),
    );

    expect(outbox.enqueueEmail).toHaveBeenCalledOnce();
  });

  it("respects a user who opted out", async () => {
    db.prisma.user.findUnique.mockResolvedValue(
      user({ emailNotifications: false }),
    );

    const result = await queueNotificationEmail(request());

    expect(result).toEqual({ sent: false, reason: "opted-out" });
    expect(outbox.enqueueEmail).not.toHaveBeenCalled();
  });

  it("respects the master switch", async () => {
    envMock.NOTIFICATION_EMAILS_ENABLED = false;

    const result = await queueNotificationEmail(request());

    expect(result).toEqual({ sent: false, reason: "notifications-disabled" });
    expect(db.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("dedupes on the notification id", async () => {
    await queueNotificationEmail(request());

    expect(outbox.enqueueEmail.mock.calls[0]![0].dedupeKey).toBe(
      "notification:notif-1",
    );
  });

  it("never throws when the outbox fails", async () => {
    outbox.enqueueEmail.mockRejectedValueOnce(new Error("db down"));

    await expect(queueNotificationEmail(request())).resolves.toEqual({
      sent: false,
      reason: "error",
    });
  });

  it("never throws when the user lookup fails", async () => {
    db.prisma.user.findUnique.mockRejectedValueOnce(new Error("db down"));

    await expect(queueNotificationEmail(request())).resolves.toMatchObject({
      sent: false,
    });
  });

  it("handles a user with no address", async () => {
    db.prisma.user.findUnique.mockResolvedValue(user({ email: null }));

    const result = await queueNotificationEmail(request());

    expect(result).toEqual({ sent: false, reason: "no-address" });
  });

  it("mints an unsubscribe token for a user who has none", async () => {
    db.prisma.user.findUnique.mockResolvedValue(
      user({ unsubscribeToken: null }),
    );

    await queueNotificationEmail(request());

    const minted = db.prisma.user.update.mock.calls[0]![0].data.unsubscribeToken;
    expect(typeof minted).toBe("string");
    expect(minted.length).toBeGreaterThan(20);
    // Must not be derivable from the id - it travels in clear text.
    expect(minted).not.toContain("user-1");
  });

  it("reuses an existing token rather than rotating it", async () => {
    await queueNotificationEmail(request());

    expect(db.prisma.user.update).not.toHaveBeenCalled();
  });

  it("drains in the background after queuing", async () => {
    await queueNotificationEmail(request());

    expect(outbox.triggerEmailDrainInBackground).toHaveBeenCalledOnce();
  });
});

describe("rendering", () => {
  const render = (over: Record<string, unknown> = {}) =>
    renderNotificationEmail({
      type: "DOUBT_ANSWER",
      title: "New Answer to Your Doubt",
      message: "Asha answered.",
      data: { doubtId: "doubt-9" },
      unsubscribeToken: "tok-abc",
      recipientName: "Ravi",
      ...over,
    } as Parameters<typeof renderNotificationEmail>[0]);

  it("escapes HTML in a user-supplied title", () => {
    const { html } = render({
      title: '<script>alert(1)</script> answered',
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in the message too", () => {
    const { html } = render({ message: 'Doubt: "<img src=x onerror=1>"' });

    expect(html).not.toContain("<img");
  });

  it("deep-links to the doubt when there is one", () => {
    expect(render().text).toContain(
      "https://app.example.edu/student/doubts/doubt-9",
    );
  });

  it("falls back when the payload has no id", () => {
    const { text } = render({ data: {} });

    expect(text).toContain("https://app.example.edu/student/doubts");
  });

  it("points the unsubscribe link at the API, not the frontend", () => {
    const { text, html } = render();

    // The route is served by the backend; the frontend has no such path.
    expect(text).toContain(
      "https://api.example.edu/api/notifications/unsubscribe/tok-abc",
    );
    expect(html).toContain("https://api.example.edu/api/notifications/");
  });

  it("always includes a way out, in both parts", () => {
    const { text, html } = render();

    expect(text).toMatch(/unsubscribe/i);
    expect(html).toMatch(/unsubscribe/i);
  });

  it("uses the notification title as the subject", () => {
    expect(render().subject).toBe("New Answer to Your Doubt");
  });
});

describe("unsubscribeByToken", () => {
  it("turns the preference off", async () => {
    db.prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

    await expect(unsubscribeByToken("tok-abc")).resolves.toBe(true);
    expect(db.prisma.user.update.mock.calls[0]![0].data).toEqual({
      emailNotifications: false,
    });
  });

  it("reports failure for an unknown token, changing nothing", async () => {
    db.prisma.user.findUnique.mockResolvedValue(null);

    await expect(unsubscribeByToken("nope")).resolves.toBe(false);
    expect(db.prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an empty token without querying", async () => {
    await expect(unsubscribeByToken("")).resolves.toBe(false);
    expect(db.prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
