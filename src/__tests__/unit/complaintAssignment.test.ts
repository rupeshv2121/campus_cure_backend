/**
 * CC-72 stage 2: assigning and reassigning complaints, without HTTP.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const prisma = {
    complaint: { findUnique: vi.fn(), update: vi.fn(async (args: unknown) => args) },
    user: { findUnique: vi.fn() },
    adminProfile: { update: vi.fn(async (args: unknown) => args) },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  };
  return { prisma };
});
const notify = vi.hoisted(() => ({
  notifyComplaintStatusChange: vi.fn(async () => undefined),
  notifyComplaintAssignment: vi.fn(async () => undefined),
  createNotification: vi.fn(async () => undefined),
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../utils/notifications.js", () => notify);
vi.mock("../../services/storage/resolutionEvidence.js", () => ({ attachResolutionEvidence: vi.fn() }));
vi.mock("../../services/sla/policy.js", () => ({ computeSlaDueAt: () => new Date(0) }));

const { assignComplaint, isAssignmentHistoryColumnError, reassignEscalated } = await import(
  "../../services/complaints/assignment.js"
);
const { Prisma } = await import("@prisma/client");

const assigner = { userId: "admin-1", role: "ADMIN" as never };
const electrician = { id: "staff-2", name: "Suresh", role: "FACULTY", approvalStatus: "APPROVED" };

/** First findUnique: the complaint. Second: the history column. */
const arrange = (complaint: Record<string, unknown>, history: unknown = []) => {
  db.prisma.complaint.findUnique
    .mockResolvedValueOnce(complaint)
    .mockResolvedValueOnce({ assignmentHistory: history });
};

beforeEach(() => {
  vi.resetAllMocks();
  db.prisma.complaint.update.mockImplementation(async (args: unknown) => args);
  db.prisma.adminProfile.update.mockImplementation(async (args: unknown) => args);
  db.prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  db.prisma.user.findUnique.mockResolvedValue(electrician);
});

describe("assignComplaint", () => {
  const raised = { title: "Fan", status: "RAISED", raisedById: "stu-1", priority: 4, assignedTo: null };

  it("assigns, restarts the clock, records history and counts it for the admin", async () => {
    arrange(raised);
    const done = await assignComplaint({ complaintId: "c1", facultyId: "staff-2", assigner });

    const data = (db.prisma.complaint.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ status: "ASSIGNED", slaDueAt: new Date(0), assignedTo: { connect: { id: "staff-2" } } });
    expect(data.assignmentHistory).toHaveLength(1);
    expect(db.prisma.adminProfile.update).toHaveBeenCalled();
    expect(notify.notifyComplaintAssignment).toHaveBeenCalledWith("staff-2", "Fan", "c1");
    expect(done).toMatchObject({ assigneeName: "Suresh", previousAssigneeId: null, priority: 4 });
  });

  it("refuses anyone who is not approved faculty", async () => {
    for (const person of [null, { ...electrician, role: "STUDENT" }, { ...electrician, approvalStatus: "PENDING" }]) {
      db.prisma.complaint.findUnique.mockResolvedValueOnce(raised);
      db.prisma.user.findUnique.mockResolvedValueOnce(person);
      await expect(
        assignComplaint({ complaintId: "c1", facultyId: "x", assigner }),
      ).rejects.toMatchObject({ status: 400, message: "Invalid faculty member" });
    }
    expect(db.prisma.complaint.update).not.toHaveBeenCalled();
  });

  it("still assigns on a database without the history column", async () => {
    arrange(raised);
    db.prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("no column", {
        code: "P2022",
        clientVersion: "x",
        meta: { column: "Complaint.assignmentHistory" },
      }),
    );

    await assignComplaint({ complaintId: "c1", facultyId: "staff-2", assigner });
    const retried = (db.prisma.complaint.update.mock.calls[db.prisma.complaint.update.mock.calls.length - 1] as unknown as [{ data: object }])[0].data;
    expect(retried).not.toHaveProperty("assignmentHistory");
    expect(retried).toHaveProperty("status", "ASSIGNED");
  });

  it("does not fail the assignment when a notification does", async () => {
    arrange(raised);
    notify.notifyComplaintAssignment.mockRejectedValueOnce(new Error("down"));
    await expect(assignComplaint({ complaintId: "c1", facultyId: "staff-2", assigner })).resolves.toBeTruthy();
  });

  it("requires both ids", async () => {
    await expect(assignComplaint({ complaintId: "", facultyId: "x", assigner })).rejects.toMatchObject({ status: 400 });
  });
});

describe("reassignEscalated", () => {
  const escalated = {
    title: "Fan",
    status: "ASSIGNED",
    escalationCount: 1,
    assignedToId: "staff-1",
    resolutionNote: null,
    raisedById: "stu-1",
    assignedTo: { id: "staff-1", name: "Old" },
  };

  it("moves an escalated complaint without changing its status, and tells all three people", async () => {
    arrange(escalated);
    await reassignEscalated({ complaintId: "c1", facultyId: "staff-2", note: "try again", assigner });

    const data = (db.prisma.complaint.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).not.toHaveProperty("status");
    expect(data).toMatchObject({ handledBySuperAdmin: true, superAdminId: "admin-1" });
    expect(String(data.resolutionNote)).toContain("SuperAdmin Note: try again");
    // Student, new assignee (via notifyComplaintAssignment), previous assignee.
    expect(notify.createNotification).toHaveBeenCalledTimes(2);
    expect(notify.notifyComplaintAssignment).toHaveBeenCalledWith("staff-2", "Fan", "c1");
  });

  it("only reassigns complaints that were escalated", async () => {
    db.prisma.complaint.findUnique.mockResolvedValueOnce({ ...escalated, escalationCount: 0 });
    await expect(
      reassignEscalated({ complaintId: "c1", facultyId: "staff-2", assigner }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuses to reassign to the same person", async () => {
    db.prisma.complaint.findUnique.mockResolvedValueOnce(escalated);
    db.prisma.user.findUnique.mockResolvedValueOnce({ ...electrician, id: "staff-1" });
    await expect(
      reassignEscalated({ complaintId: "c1", facultyId: "staff-1", assigner }),
    ).rejects.toMatchObject({ message: "Complaint is already assigned to this faculty" });
  });
});

describe("isAssignmentHistoryColumnError", () => {
  it("recognises only a missing assignmentHistory column", () => {
    const missing = (column: string) =>
      new Prisma.PrismaClientKnownRequestError("x", { code: "P2022", clientVersion: "x", meta: { column } });
    expect(isAssignmentHistoryColumnError(missing("Complaint.assignmentHistory"))).toBe(true);
    expect(isAssignmentHistoryColumnError(missing("Complaint.other"))).toBe(false);
    expect(isAssignmentHistoryColumnError(new Error("boom"))).toBe(false);
  });
});
