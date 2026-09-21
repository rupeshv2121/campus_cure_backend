/**
 * CC-64: retention limits.
 *
 * What is NOT on a clock matters more than what is. A complaints system that
 * quietly deletes complaints after a year has the one failure mode it cannot
 * have, and the audit log is the thing CC-61 exists to preserve.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  // The arg is declared so the mock's call tuple has an element - without it
  // `mock.calls[0]![0]` is a type error rather than a runtime one.
  const model = () => ({
    deleteMany: vi.fn(async (_args: { where: Record<string, never> }) => ({
      count: 0,
    })),
  });
  return {
    prisma: {
      notification: model(),
      doubtView: model(),
      emailOutbox: model(),
      complaint: model(),
      doubt: model(),
      answer: model(),
      auditLog: model(),
      user: model(),
    },
  };
});

const env = vi.hoisted(() => ({
  RETENTION_ENABLED: true,
  RETENTION_NOTIFICATION_DAYS: 180,
  RETENTION_DOUBT_VIEW_DAYS: 90,
  RETENTION_EMAIL_SENT_DAYS: 90,
  RETENTION_EMAIL_FAILED_DAYS: 365,
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => env);

import { runRetentionSweep } from "../../services/privacy/retention.js";


/**
 * First argument of a mock's first (or nth) call.
 *
 * Wrapped because `noUncheckedIndexedAccess` makes every `mock.calls[n][0]` a
 * possibly-undefined access, which would otherwise need assertions at each of
 * the sites below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const argOf = (fn: { mock: { calls: any[][] } }, call = 0): any =>
  fn.mock.calls[call]![0];

const daysAgo = (cut: Date) =>
  Math.round((Date.now() - cut.getTime()) / 86_400_000);

beforeEach(() => {
  vi.clearAllMocks();
  env.RETENTION_ENABLED = true;
  for (const model of Object.values(db.prisma)) {
    model.deleteMany.mockResolvedValue({ count: 0 });
  }
});

describe("runRetentionSweep", () => {
  it("returns zeroes and queries nothing when disabled", async () => {
    env.RETENTION_ENABLED = false;

    await expect(runRetentionSweep()).resolves.toEqual({
      notifications: 0,
      doubtViews: 0,
      sentEmails: 0,
      failedEmails: 0,
    });
    expect(db.prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes notifications past the limit", async () => {
    db.prisma.notification.deleteMany.mockResolvedValueOnce({ count: 7 });

    const result = await runRetentionSweep();

    expect(result.notifications).toBe(7);
    const cut = argOf(db.prisma.notification.deleteMany, 0).where
      .createdAt.lt;
    expect(daysAgo(cut)).toBe(180);
  });

  it("uses each table's own cutoff", async () => {
    await runRetentionSweep();

    expect(
      daysAgo(
        argOf(db.prisma.doubtView.deleteMany, 0).where.viewedAt.lt,
      ),
    ).toBe(90);
  });

  it("keeps failed mail longer than sent mail", async () => {
    await runRetentionSweep();

    const sentCut =
      argOf(db.prisma.emailOutbox.deleteMany, 0).where.createdAt.lt;
    const failedCut =
      argOf(db.prisma.emailOutbox.deleteMany, 1).where.createdAt.lt;

    // Diagnosing "why did nothing arrive" needs the history.
    expect(failedCut.getTime()).toBeLessThan(sentCut.getTime());
  });

  it("separates sent from failed by status", async () => {
    await runRetentionSweep();

    expect(
      argOf(db.prisma.emailOutbox.deleteMany, 0).where.status,
    ).toBe("SENT");
    expect(
      argOf(db.prisma.emailOutbox.deleteMany, 1).where.status,
    ).toBe("FAILED");
  });

  it("NEVER touches complaints, doubts, answers, users or the audit log", async () => {
    await runRetentionSweep();

    for (const model of ["complaint", "doubt", "answer", "auditLog", "user"] as const) {
      expect(
        db.prisma[model].deleteMany,
        `${model} must not be on a retention clock`,
      ).not.toHaveBeenCalled();
    }
  });
});
