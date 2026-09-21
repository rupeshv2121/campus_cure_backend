/**
 * CC-03: the email outbox and its drain.
 *
 * The two behaviours worth pinning down are that a request handler never waits
 * on the provider, and that a permanent rejection is parked rather than
 * retried five times. Everything else is the retry state machine around them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    emailOutbox: {
      create: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

const provider = vi.hoisted(() => {
  class PermanentEmailError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PermanentEmailError";
    }
  }
  return { sendEmail: vi.fn(), PermanentEmailError };
});

vi.mock("../../config/database.js", () => db);
vi.mock("./../../services/email/resend.js", () => provider);
vi.mock("../../config/env.js", () => ({
  EMAIL_ENABLED: true,
  EMAIL_MAX_ATTEMPTS: 5,
  EMAIL_DRAIN_BATCH_SIZE: 20,
}));

import {
  enqueueEmail,
  runEmailDrain,
  triggerEmailDrainInBackground,
} from "../../services/email/outbox.js";

const row = (over: Record<string, unknown> = {}) => ({
  id: "mail-1",
  to: "student@example.edu",
  subject: "Your doubt was answered",
  bodyText: "Someone answered.",
  bodyHtml: null,
  status: "PENDING",
  attempts: 0,
  lastError: null,
  dedupeKey: null,
  scheduledAt: new Date(Date.now() - 1000),
  sentAt: null,
  providerId: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.emailOutbox.create.mockResolvedValue({ id: "mail-1" });
  db.prisma.emailOutbox.upsert.mockResolvedValue({ id: "mail-1" });
  db.prisma.emailOutbox.update.mockResolvedValue({});
  db.prisma.emailOutbox.count.mockResolvedValue(0);
  provider.sendEmail.mockResolvedValue({ providerId: "resend-abc" });
});

describe("enqueueEmail", () => {
  const input = {
    to: "student@example.edu",
    subject: "Hello",
    text: "Body",
  };

  it("writes a row and sends nothing synchronously", async () => {
    const result = await enqueueEmail(input);

    expect(result).toEqual({ queued: true, id: "mail-1" });
    expect(db.prisma.emailOutbox.create).toHaveBeenCalledOnce();
    // The whole point: no provider call on the request path.
    expect(provider.sendEmail).not.toHaveBeenCalled();
  });

  it("normalizes the recipient", async () => {
    await enqueueEmail({ ...input, to: "  Student@Example.EDU " });

    expect(db.prisma.emailOutbox.create.mock.calls[0]![0].data.to).toBe(
      "student@example.edu",
    );
  });

  it("upserts on a dedupe key so a retried handler queues one message", async () => {
    await enqueueEmail({ ...input, dedupeKey: "complaint-assigned:c1" });

    expect(db.prisma.emailOutbox.create).not.toHaveBeenCalled();
    const call = db.prisma.emailOutbox.upsert.mock.calls[0]![0];
    expect(call.where).toEqual({ dedupeKey: "complaint-assigned:c1" });
    // Empty update: the existing row may already be SENT.
    expect(call.update).toEqual({});
  });

  it("rejects an invalid recipient at enqueue time, not after five retries", async () => {
    for (const bad of ["", "   ", "not-an-email", "a@b", "two @spaces.com"]) {
      const result = await enqueueEmail({ ...input, to: bad });
      expect(result.queued).toBe(false);
      expect(result.reason).toBe("invalid-recipient");
    }
    expect(db.prisma.emailOutbox.create).not.toHaveBeenCalled();
  });

  it("rejects an empty subject", async () => {
    const result = await enqueueEmail({ ...input, subject: "   " });
    expect(result).toEqual({ queued: false, reason: "empty-subject" });
  });

  it("uses the surrounding transaction when given one", async () => {
    const tx = { emailOutbox: { create: vi.fn().mockResolvedValue({ id: "tx-1" }) } };

    await enqueueEmail({ ...input, tx: tx as never });

    expect(tx.emailOutbox.create).toHaveBeenCalledOnce();
    expect(db.prisma.emailOutbox.create).not.toHaveBeenCalled();
  });
});

describe("runEmailDrain", () => {
  it("sends a due message and records the provider id", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([row()]);

    const result = await runEmailDrain();

    expect(result).toMatchObject({ attempted: 1, sent: 1, failed: 0 });
    const update = db.prisma.emailOutbox.update.mock.calls[0]![0];
    expect(update.data.status).toBe("SENT");
    expect(update.data.providerId).toBe("resend-abc");
    expect(update.data.sentAt).toBeInstanceOf(Date);
  });

  it("only claims PENDING rows that are due", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([]);

    await runEmailDrain();

    const where = db.prisma.emailOutbox.findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("PENDING");
    expect(where.scheduledAt.lte).toBeInstanceOf(Date);
  });

  it("retries a transient failure with backoff and leaves it PENDING", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([row()]);
    provider.sendEmail.mockRejectedValueOnce(new Error("503 upstream"));

    const result = await runEmailDrain();

    expect(result).toMatchObject({ retrying: 1, failed: 0, sent: 0 });
    const data = db.prisma.emailOutbox.update.mock.calls[0]![0].data;
    expect(data.attempts).toBe(1);
    expect(data.lastError).toContain("503");
    expect(data.status).toBeUndefined();
    expect(data.scheduledAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("backs off further on each attempt", async () => {
    const delays: number[] = [];

    for (const attempts of [1, 3]) {
      vi.clearAllMocks();
      db.prisma.emailOutbox.update.mockResolvedValue({});
      db.prisma.emailOutbox.findMany.mockResolvedValueOnce([row({ attempts })]);
      provider.sendEmail.mockRejectedValueOnce(new Error("boom"));

      await runEmailDrain();
      delays.push(
        db.prisma.emailOutbox.update.mock.calls[0]![0].data.scheduledAt.getTime() -
          Date.now(),
      );
    }

    expect(delays[1]).toBeGreaterThan(delays[0]!);
  });

  it("parks a message that reaches the attempt cap", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([row({ attempts: 4 })]);
    provider.sendEmail.mockRejectedValueOnce(new Error("still down"));

    const result = await runEmailDrain();

    expect(result).toMatchObject({ failed: 1, retrying: 0 });
    expect(db.prisma.emailOutbox.update.mock.calls[0]![0].data.status).toBe(
      "FAILED",
    );
  });

  it("parks a permanent rejection immediately, without burning retries", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([row()]);
    provider.sendEmail.mockRejectedValueOnce(
      new provider.PermanentEmailError("domain not verified"),
    );

    const result = await runEmailDrain();

    expect(result).toMatchObject({ failed: 1, retrying: 0 });
    const data = db.prisma.emailOutbox.update.mock.calls[0]![0].data;
    expect(data.status).toBe("FAILED");
    // One attempt, not five.
    expect(data.attempts).toBe(1);
  });

  it("keeps a parked row rather than deleting it", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([row({ attempts: 4 })]);
    provider.sendEmail.mockRejectedValueOnce(new Error("gone"));

    await runEmailDrain();

    expect(db.prisma.emailOutbox.update).toHaveBeenCalled();
    expect(
      (db.prisma.emailOutbox as Record<string, unknown>).delete,
    ).toBeUndefined();
  });

  it("truncates a huge provider error", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([row()]);
    provider.sendEmail.mockRejectedValueOnce(new Error("x".repeat(5000)));

    await runEmailDrain();

    expect(
      db.prisma.emailOutbox.update.mock.calls[0]![0].data.lastError.length,
    ).toBeLessThanOrEqual(500);
  });

  it("keeps going after one message fails", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([
      row({ id: "a" }),
      row({ id: "b" }),
    ]);
    provider.sendEmail
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ providerId: "resend-b" });

    const result = await runEmailDrain();

    expect(result).toMatchObject({ attempted: 2, sent: 1, retrying: 1 });
  });

  it("caps the batch so one drain cannot exhaust a daily quota", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([]);

    await runEmailDrain();

    expect(db.prisma.emailOutbox.findMany.mock.calls[0]![0].take).toBe(20);
  });

  it("passes the stored html through when present", async () => {
    db.prisma.emailOutbox.findMany.mockResolvedValueOnce([
      row({ bodyHtml: "<p>hi</p>" }),
    ]);

    await runEmailDrain();

    expect(provider.sendEmail.mock.calls[0]![0].html).toBe("<p>hi</p>");
  });
});

describe("triggerEmailDrainInBackground", () => {
  it("does not throw when the drain rejects", async () => {
    db.prisma.emailOutbox.findMany.mockRejectedValueOnce(new Error("db down"));

    expect(() => triggerEmailDrainInBackground()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
