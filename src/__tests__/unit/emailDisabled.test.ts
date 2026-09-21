/**
 * CC-03 with no RESEND_API_KEY.
 *
 * The state of any checkout without the key, and of the deployment until it is
 * set there too. The absence must be contained: nothing queries the outbox
 * table, which may not have been migrated.
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

const provider = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  PermanentEmailError: class extends Error {},
}));

vi.mock("../../config/database.js", () => db);
vi.mock("./../../services/email/resend.js", () => provider);
vi.mock("../../config/env.js", () => ({
  EMAIL_ENABLED: false,
  EMAIL_MAX_ATTEMPTS: 5,
  EMAIL_DRAIN_BATCH_SIZE: 20,
}));

import {
  enqueueEmail,
  getEmailStats,
  runEmailDrain,
  triggerEmailDrainInBackground,
} from "../../services/email/outbox.js";

beforeEach(() => vi.clearAllMocks());

describe("email not configured", () => {
  it("does not queue, and touches no table", async () => {
    const result = await enqueueEmail({
      to: "student@example.edu",
      subject: "Hello",
      text: "Body",
    });

    expect(result).toEqual({ queued: false, reason: "disabled" });
    expect(db.prisma.emailOutbox.create).not.toHaveBeenCalled();
    expect(db.prisma.emailOutbox.upsert).not.toHaveBeenCalled();
  });

  it("drains to zeroes without querying", async () => {
    await expect(runEmailDrain()).resolves.toEqual({
      attempted: 0,
      sent: 0,
      retrying: 0,
      failed: 0,
    });

    expect(db.prisma.emailOutbox.findMany).not.toHaveBeenCalled();
  });

  it("reports itself disabled in stats without querying", async () => {
    const stats = await getEmailStats();

    expect(stats.enabled).toBe(false);
    expect(db.prisma.emailOutbox.count).not.toHaveBeenCalled();
  });

  it("makes the background trigger a no-op", async () => {
    triggerEmailDrainInBackground();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(db.prisma.emailOutbox.findMany).not.toHaveBeenCalled();
    expect(provider.sendEmail).not.toHaveBeenCalled();
  });
});
