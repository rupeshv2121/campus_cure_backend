/**
 * CC-31: the nightly sweep.
 *
 * Two properties carry the feature: a complaint waiting on the student never
 * counts against staff, and a complaint that stays overdue escalates once per
 * cooldown rather than once per sweep. The rest is the ladder.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    complaint: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

const notifications = vi.hoisted(() => ({ createNotification: vi.fn() }));

const env = vi.hoisted(() => ({
  SLA_ENABLED: true,
  SLA_MULTIPLIER: 1,
  SLA_MAX_ESCALATIONS: 2,
  SLA_ESCALATION_COOLDOWN_HOURS: 24,
  SLA_CONFIRMATION_REMINDER_HOURS: 72,
  SLA_SWEEP_BATCH_SIZE: 50,
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../utils/notifications.js", () => notifications);
vi.mock("../../config/env.js", () => env);

import { getSlaStats, runSlaSweep } from "../../services/sla/escalation.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

const overdue = (over: Record<string, unknown> = {}) => ({
  id: "c-1",
  title: "Broken fan in ML02",
  status: "RAISED",
  priority: 3,
  raisedById: "student-1",
  assignedToId: null,
  escalationCount: 0,
  slaDueAt: hoursAgo(5),
  lastEscalationAt: null,
  ...over,
});

/** findMany is called twice per sweep: overdue, then pending-confirmation. */
const arrange = (escalatable: unknown[], pending: unknown[] = []) => {
  db.prisma.complaint.findMany
    .mockResolvedValueOnce(escalatable)
    .mockResolvedValueOnce(pending);
};

const updateData = (call = 0) =>
  db.prisma.complaint.update.mock.calls[call]![0].data;

beforeEach(() => {
  vi.clearAllMocks();
  env.SLA_ENABLED = true;
  env.SLA_MAX_ESCALATIONS = 2;
  db.prisma.complaint.update.mockResolvedValue({});
  db.prisma.complaint.count.mockResolvedValue(0);
  db.prisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
  notifications.createNotification.mockResolvedValue({ id: "n-1" });
});

describe("selection", () => {
  it("only looks at statuses where staff are the blocker", async () => {
    arrange([]);

    await runSlaSweep();

    const where = db.prisma.complaint.findMany.mock.calls[0]![0].where;
    expect(where.status.in).toEqual(["RAISED", "ASSIGNED", "IN_PROGRESS"]);
    expect(where.slaDueAt.lte).toBeInstanceOf(Date);
  });

  it("caps the batch so one run cannot escalate everything", async () => {
    arrange([]);

    await runSlaSweep();

    expect(db.prisma.complaint.findMany.mock.calls[0]![0].take).toBe(50);
  });

  it("returns zeroes and queries nothing when disabled", async () => {
    env.SLA_ENABLED = false;

    const result = await runSlaSweep();

    expect(result.examined).toBe(0);
    expect(db.prisma.complaint.findMany).not.toHaveBeenCalled();
  });
});

describe("escalation ladder", () => {
  it("increments the counter the admin queue already sorts by", async () => {
    arrange([overdue()]);

    const result = await runSlaSweep();

    expect(result.escalated).toBe(1);
    expect(updateData().escalationCount).toBe(1);
    expect(updateData().lastEscalationAt).toBeInstanceOf(Date);
  });

  it("pushes the deadline out so the next sweep does not re-fire", async () => {
    arrange([overdue()]);

    await runSlaSweep();

    expect(updateData().slaDueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("hands over to the super admin at the cap", async () => {
    arrange([overdue({ escalationCount: 1 })]);

    const result = await runSlaSweep();

    expect(result.escalatedToSuperAdmin).toBe(1);
    expect(updateData().status).toBe("ESCALATED_TO_SUPERADMIN");
    // Nothing escalates past the top, so no clock runs there.
    expect(updateData().slaDueAt).toBeNull();
  });

  it("notifies only super admins once it reaches the top", async () => {
    arrange([overdue({ escalationCount: 1 })]);

    await runSlaSweep();

    expect(db.prisma.user.findMany.mock.calls[0]![0].where.role).toBe(
      "SUPER_ADMIN",
    );
  });

  it("notifies admins when nobody has picked it up yet", async () => {
    arrange([overdue({ status: "RAISED" })]);

    await runSlaSweep();

    expect(db.prisma.user.findMany.mock.calls[0]![0].where.role.in).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    expect(notifications.createNotification).toHaveBeenCalled();
  });

  it("notifies the assignee when they are the one sitting on it", async () => {
    arrange([overdue({ status: "ASSIGNED", assignedToId: "faculty-7" })]);

    await runSlaSweep();

    const recipients = notifications.createNotification.mock.calls.map(
      (call) => call[0].userId,
    );
    expect(recipients).toContain("faculty-7");
  });

  it("says how far past the deadline it is", async () => {
    arrange([overdue({ slaDueAt: hoursAgo(9) })]);

    await runSlaSweep();

    expect(notifications.createNotification.mock.calls[0]![0].message).toContain(
      "9h",
    );
  });
});

describe("cooldown", () => {
  it("skips a complaint escalated within the cooldown", async () => {
    arrange([overdue({ lastEscalationAt: hoursAgo(2) })]);

    const result = await runSlaSweep();

    expect(result.skippedCooldown).toBe(1);
    expect(result.escalated).toBe(0);
    expect(db.prisma.complaint.update).not.toHaveBeenCalled();
  });

  it("escalates again once the cooldown has passed", async () => {
    arrange([overdue({ lastEscalationAt: hoursAgo(30) })]);

    const result = await runSlaSweep();

    expect(result.escalated).toBe(1);
  });
});

describe("pending confirmation", () => {
  const waiting = overdue({
    status: "PENDING_CONFIRMATION",
    slaDueAt: null,
    raisedById: "student-9",
  });

  it("reminds the student", async () => {
    arrange([], [waiting]);

    const result = await runSlaSweep();

    expect(result.reminded).toBe(1);
    expect(notifications.createNotification.mock.calls[0]![0].userId).toBe(
      "student-9",
    );
  });

  it("NEVER counts against staff", async () => {
    arrange([], [waiting]);

    const result = await runSlaSweep();

    // A student taking a week to confirm is not a staff failure, and counting
    // it as one makes the metric the admin queue sorts by dishonest.
    expect(result.escalated).toBe(0);
    expect(updateData()).not.toHaveProperty("escalationCount");
    expect(updateData()).not.toHaveProperty("status");
  });

  it("never auto-resolves on the student's behalf", async () => {
    arrange([], [waiting]);

    await runSlaSweep();

    expect(JSON.stringify(updateData())).not.toContain("RESOLVED");
  });

  it("selects on how long it has been waiting, not on slaDueAt", async () => {
    arrange([], []);

    await runSlaSweep();

    const where = db.prisma.complaint.findMany.mock.calls[1]![0].where;
    expect(where.status).toBe("PENDING_CONFIRMATION");
    expect(where.pendingConfirmationAt.lte).toBeInstanceOf(Date);
  });

  it("respects the cooldown too", async () => {
    arrange([], [{ ...waiting, lastEscalationAt: hoursAgo(1) }]);

    const result = await runSlaSweep();

    expect(result.reminded).toBe(0);
    expect(result.skippedCooldown).toBe(1);
  });
});

describe("resilience", () => {
  it("keeps going when one complaint fails", async () => {
    arrange([overdue({ id: "c-1" }), overdue({ id: "c-2" })]);
    db.prisma.complaint.update
      .mockRejectedValueOnce(new Error("row locked"))
      .mockResolvedValue({});

    const result = await runSlaSweep();

    // The sweep runs once a day: aborting on the first failure means every
    // complaint after it waits another 24 hours.
    expect(result.examined).toBe(2);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.escalated).toBe(1);
  });

  it("counts a notification failure without losing the escalation", async () => {
    arrange([overdue()]);
    notifications.createNotification.mockRejectedValueOnce(
      new Error("smtp down"),
    );

    const result = await runSlaSweep();

    expect(result.escalated).toBe(1);
    expect(result.errors).toBe(1);
  });
});

describe("getSlaStats", () => {
  it("reports disabled without querying", async () => {
    env.SLA_ENABLED = false;

    expect(await getSlaStats()).toEqual({ enabled: false });
    expect(db.prisma.complaint.count).not.toHaveBeenCalled();
  });

  it("counts overdue, due soon, escalated and at-top", async () => {
    db.prisma.complaint.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    expect(await getSlaStats()).toEqual({
      enabled: true,
      overdue: 3,
      dueSoon: 5,
      everEscalated: 2,
      atTop: 1,
    });
  });
});
