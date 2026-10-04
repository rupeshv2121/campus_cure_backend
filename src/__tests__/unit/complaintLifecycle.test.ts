/**
 * CC-72 stage 2: the complaint lifecycle, tested without HTTP.
 *
 * These rules were inline in three controllers. Pinning them here is what
 * made it safe to move them, and is what keeps the staff and admin paths
 * from drifting apart again.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    complaint: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(async () => ({ escalationCount: 1 })),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    adminProfile: { update: vi.fn(async () => ({})) },
    user: { findMany: vi.fn(async () => [] as Array<{ id: string }>) },
  },
}));
const notify = vi.hoisted(() => ({
  notifyComplaintStatusChange: vi.fn(async () => undefined),
  createNotification: vi.fn(async () => undefined),
}));
const evidence = vi.hoisted(() => ({ attachResolutionEvidence: vi.fn(async () => []) }));

vi.mock("../../config/database.js", () => db);
vi.mock("../../utils/notifications.js", () => notify);
vi.mock("../../services/storage/resolutionEvidence.js", () => evidence);
vi.mock("../../services/sla/policy.js", () => ({
  // Deterministic stand-in: a due date only while staff hold the complaint.
  computeSlaDueAt: (status: string) =>
    status === "PENDING_CONFIRMATION" || status === "RESOLVED" ? null : new Date(0),
}));

const {
  ComplaintError,
  buildStatusUpdate,
  changeComplaintStatus,
  confirmResolution,
  parseRejectionHistory,
  rejectResolution,
  submitFeedback,
  validateFeedback,
} = await import("../../services/complaints/lifecycle.js");

const NOW = new Date("2026-10-04T10:00:00Z");

const complaint = (over: Record<string, unknown> = {}) => ({
  status: "IN_PROGRESS",
  priority: 3,
  assignedToId: "staff-1",
  raisedById: "student-1",
  title: "Fan broken",
  resolutionNote: null,
  rejectionHistory: [],
  raisedBy: { name: "Ravi" },
  ...over,
});

const staff = { kind: "staff" as const, userId: "staff-1" };
const admin = { kind: "admin" as const, userId: "admin-1" };

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.complaint.updateMany.mockResolvedValue({ count: 1 });
});

describe("buildStatusUpdate (pure)", () => {
  it("stamps when the fix was claimed, and stops the SLA clock", () => {
    const data = buildStatusUpdate({ actor: "staff", to: "PENDING_CONFIRMATION", priority: 3, now: NOW });
    expect(data).toMatchObject({
      status: "PENDING_CONFIRMATION",
      resolutionDate: NOW,
      pendingConfirmationAt: NOW,
      handledBySuperAdmin: false,
      slaDueAt: null,
    });
  });

  it("does not reset the super-admin flag when an admin claims the fix", () => {
    const data = buildStatusUpdate({ actor: "admin", to: "PENDING_CONFIRMATION", priority: 3, now: NOW });
    expect(data).not.toHaveProperty("handledBySuperAdmin");
  });

  it("clears a stale pending stamp on any other move, and keeps the clock running", () => {
    const data = buildStatusUpdate({ actor: "staff", to: "IN_PROGRESS", priority: 3, now: NOW });
    expect(data.pendingConfirmationAt).toBeNull();
    expect(data.slaDueAt).toEqual(new Date(0));
  });

  it("keeps a staff note on any move, an admin note only when resolving", () => {
    expect(buildStatusUpdate({ actor: "staff", to: "IN_PROGRESS", priority: 1, resolutionNote: "n" }).resolutionNote).toBe("n");
    expect(buildStatusUpdate({ actor: "admin", to: "IN_PROGRESS", priority: 1, resolutionNote: "n" })).not.toHaveProperty("resolutionNote");
    expect(buildStatusUpdate({ actor: "admin", to: "RESOLVED", priority: 1, resolutionNote: "n" }).resolutionNote).toBe("n");
  });
});

describe("changeComplaintStatus", () => {
  it("lets staff move only their own complaint forward", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ assignedToId: "someone-else" }));
    await expect(
      changeComplaintStatus({ complaintId: "c1", to: "IN_PROGRESS", actor: staff }),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.prisma.complaint.update).not.toHaveBeenCalled();
  });

  it("refuses staff a status outside their two", async () => {
    await expect(
      changeComplaintStatus({ complaintId: "c1", to: "RESOLVED", actor: staff }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.prisma.complaint.findUnique).not.toHaveBeenCalled();
  });

  it("never reopens a resolved complaint, but lets an admin re-save it", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ status: "RESOLVED" }));
    await expect(
      changeComplaintStatus({ complaintId: "c1", to: "ASSIGNED", actor: admin }),
    ).rejects.toMatchObject({ status: 400 });

    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ status: "RESOLVED" }));
    await expect(
      changeComplaintStatus({ complaintId: "c1", to: "RESOLVED", actor: admin }),
    ).resolves.toEqual({ from: "RESOLVED", to: "RESOLVED" });
  });

  it("notifies the student only when the status actually changes", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint());
    await changeComplaintStatus({ complaintId: "c1", to: "PENDING_CONFIRMATION", actor: staff });
    expect(notify.notifyComplaintStatusChange).toHaveBeenCalledWith(
      "student-1", "Fan broken", "IN_PROGRESS", "PENDING_CONFIRMATION", "c1",
    );

    vi.clearAllMocks();
    db.prisma.complaint.findUnique.mockResolvedValue(complaint());
    await changeComplaintStatus({ complaintId: "c1", to: "IN_PROGRESS", actor: staff });
    expect(notify.notifyComplaintStatusChange).not.toHaveBeenCalled();
  });

  it("still succeeds when the notification fails", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint());
    notify.notifyComplaintStatusChange.mockRejectedValueOnce(new Error("down"));
    await expect(
      changeComplaintStatus({ complaintId: "c1", to: "PENDING_CONFIRMATION", actor: staff }),
    ).resolves.toBeTruthy();
  });

  it("counts an admin's direct close, but not one staff already fixed", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ status: "ASSIGNED" }));
    await changeComplaintStatus({ complaintId: "c1", to: "RESOLVED", actor: admin });
    expect(db.prisma.adminProfile.update).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ status: "PENDING_CONFIRMATION" }));
    await changeComplaintStatus({ complaintId: "c1", to: "RESOLVED", actor: admin });
    expect(db.prisma.adminProfile.update).not.toHaveBeenCalled();
  });

  it("falls back without pendingConfirmationAt on a database missing that column", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint());
    const { Prisma } = await import("@prisma/client");
    db.prisma.complaint.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("missing column", { code: "P2022", clientVersion: "x" }),
    );

    await changeComplaintStatus({ complaintId: "c1", to: "PENDING_CONFIRMATION", actor: staff });
    const retry = (db.prisma.complaint.update.mock.calls[1] as unknown as [{ data: object }])[0].data;
    expect(retry).not.toHaveProperty("pendingConfirmationAt");
    expect(retry).toHaveProperty("status", "PENDING_CONFIRMATION");
  });
});

describe("student verdicts", () => {
  it("only the student who raised it may confirm", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ status: "PENDING_CONFIRMATION" }));
    await expect(confirmResolution("c1", "intruder")).rejects.toMatchObject({ status: 403 });
  });

  it("confirms only while the write still finds it pending", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ status: "PENDING_CONFIRMATION" }));
    await confirmResolution("c1", "student-1");
    const call = db.prisma.complaint.updateMany.mock.calls[0] as unknown as [{ where: object; data: object }];
    expect(call[0].where).toEqual({ id: "c1", status: "PENDING_CONFIRMATION" });
    expect(call[0].data).toMatchObject({ status: "RESOLVED", studentConfirmed: true });
  });

  /** The race this change closes: a double tap used to escalate twice. */
  it("answers 409 when another request already decided", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(complaint({ status: "PENDING_CONFIRMATION" }));
    db.prisma.complaint.updateMany.mockResolvedValueOnce({ count: 0 });

    const error = await rejectResolution("c1", "student-1", "still broken").catch((e) => e);
    expect(error).toBeInstanceOf(ComplaintError);
    expect(error.status).toBe(409);
    expect(notify.createNotification).not.toHaveBeenCalled();
  });

  it("sends a rejection back to the assignee, logs it, and tells super admins", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue(
      complaint({ status: "PENDING_CONFIRMATION", rejectionHistory: [{ reason: "earlier" }] }),
    );
    db.prisma.user.findMany.mockResolvedValue([{ id: "sa-1" }]);

    await rejectResolution("c1", "student-1", "still broken");

    const data = (db.prisma.complaint.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data.status).toBe("ASSIGNED");
    expect(data.escalationCount).toEqual({ increment: 1 });
    expect(data.rejectionHistory).toHaveLength(2);
    expect(notify.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "sa-1", title: "Complaint Rejected by Student - Escalated" }),
    );
  });

  it("requires a reason to reject", async () => {
    await expect(rejectResolution("c1", "student-1", "   ")).rejects.toMatchObject({ status: 400 });
  });
});

describe("feedback", () => {
  it("accepts an integer 1-5 and trims the comment", () => {
    expect(validateFeedback(4, "  good  ")).toEqual({ rating: 4, comment: "good" });
    expect(validateFeedback(5, undefined)).toEqual({ rating: 5, comment: null });
  });

  it("rejects anything else", () => {
    for (const rating of [0, 6, 3.5, "4", null]) {
      expect(() => validateFeedback(rating, "")).toThrow(ComplaintError);
    }
    expect(() => validateFeedback(3, "x".repeat(1001))).toThrow(ComplaintError);
  });

  it("is accepted once, even when two submissions race", async () => {
    db.prisma.complaint.findUnique.mockResolvedValue({ raisedById: "student-1", status: "RESOLVED", feedbackRating: null });
    db.prisma.complaint.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(submitFeedback("c1", "student-1", 5, "")).rejects.toMatchObject({ status: 400 });
  });
});

describe("parseRejectionHistory", () => {
  it("reads a JSON column, a JSON string, and survives garbage", () => {
    expect(parseRejectionHistory([{ reason: "a" }])).toHaveLength(1);
    expect(parseRejectionHistory('[{"reason":"a"}]')).toHaveLength(1);
    expect(parseRejectionHistory("{not json")).toEqual([]);
    expect(parseRejectionHistory(null)).toEqual([]);
  });
});
