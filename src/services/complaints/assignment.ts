/**
 * Assigning complaints to staff (CC-72 stage 2).
 *
 * Two entry points that used to be two 150-line controller handlers sharing
 * half their code by copy:
 *
 *  - assignComplaint: an admin routes a complaint (it becomes ASSIGNED, the
 *    SLA clock restarts, the admin's tally goes up).
 *  - reassignEscalated: a super admin moves an ESCALATED complaint to
 *    someone else without changing its status, with an optional note.
 *
 * Both append to the complaint's assignment history and notify the people
 * involved. Behaviour is carried over unchanged.
 */

import { ApprovalStatus, ComplaintStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  appendComplaintAssignmentHistory,
  buildComplaintAssignmentHistoryEntry,
} from "../../utils/complaintAssignmentHistory.js";
import {
  createNotification,
  notifyComplaintAssignment,
  notifyComplaintStatusChange,
} from "../../utils/notifications.js";
import { computeSlaDueAt } from "../sla/policy.js";
import { ComplaintError } from "./lifecycle.js";

/** The admin or super admin doing the assigning. */
export interface Assigner {
  userId: string;
  role: Role;
}

/**
 * True when an error means the `assignmentHistory` column does not exist yet
 * (a database whose migration has not run). Assignment then proceeds without
 * history rather than failing outright.
 */
export const isAssignmentHistoryColumnError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code !== "P2022") return false;
    const column =
      typeof error.meta === "object" && error.meta && "column" in error.meta
        ? String((error.meta as { column?: string }).column || "")
        : "";
    return column.includes("assignmentHistory");
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return error.message.includes("assignmentHistory");
  }
  return false;
};

/** Only approved faculty accounts can hold a complaint (that includes CC-27 non-teaching staff). */
const loadAssignee = async (facultyId: string) => {
  const faculty = await prisma.user.findUnique({
    where: { id: facultyId },
    select: { id: true, name: true, role: true, approvalStatus: true },
  });
  if (
    !faculty ||
    faculty.role !== Role.FACULTY ||
    faculty.approvalStatus !== ApprovalStatus.APPROVED
  ) {
    throw new ComplaintError("Invalid faculty member", 400);
  }
  return faculty;
};

/** The current history, or [] if the column is missing. */
const readHistory = async (complaintId: string): Promise<unknown> => {
  try {
    const row = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { assignmentHistory: true },
    });
    return row?.assignmentHistory ?? [];
  } catch (error) {
    if (isAssignmentHistoryColumnError(error)) return [];
    throw error;
  }
};

const quietly = async (send: () => Promise<unknown>) => {
  try {
    await send();
  } catch (error) {
    console.error("[complaints] assignment notification failed:", error);
  }
};

/** An admin assigns a complaint. Returns what the audit entry needs. */
export const assignComplaint = async (input: {
  complaintId: unknown;
  facultyId: unknown;
  assigner: Assigner;
}) => {
  const { complaintId, facultyId, assigner } = input;
  if (typeof complaintId !== "string" || !complaintId || typeof facultyId !== "string" || !facultyId) {
    throw new ComplaintError("Complaint ID and Faculty ID are required", 400);
  }

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: {
      title: true,
      status: true,
      raisedById: true,
      priority: true,
      assignedTo: { select: { id: true, name: true } },
    },
  });
  if (!complaint) throw new ComplaintError("Complaint not found", 404);

  const faculty = await loadAssignee(facultyId);

  const entry = buildComplaintAssignmentHistoryEntry({
    fromAssigneeId: complaint.assignedTo?.id ?? null,
    fromAssigneeName: complaint.assignedTo?.name ?? null,
    toAssigneeId: facultyId,
    toAssigneeName: faculty.name,
    performedById: assigner.userId,
    performedByRole: assigner.role,
    mode: "ADMIN",
  });

  const base = {
    assignedTo: { connect: { id: facultyId } },
    status: ComplaintStatus.ASSIGNED,
    assignedAt: new Date(),
    // CC-31: the clock moves from "nobody has picked this up" to "the
    // assignee has not fixed it". Different budget, fresh deadline.
    slaDueAt: computeSlaDueAt(ComplaintStatus.ASSIGNED, complaint.priority),
  };
  const tally = prisma.adminProfile.update({
    where: { userId: assigner.userId },
    data: { complaintsAssigned: { increment: 1 } },
  });

  try {
    await prisma.$transaction([
      prisma.complaint.update({
        where: { id: complaintId },
        data: {
          ...base,
          assignmentHistory: appendComplaintAssignmentHistory(await readHistory(complaintId), entry),
        },
      }),
      tally,
    ]);
  } catch (error) {
    if (!isAssignmentHistoryColumnError(error)) throw error;
    await prisma.$transaction([
      prisma.complaint.update({ where: { id: complaintId }, data: base }),
      prisma.adminProfile.update({
        where: { userId: assigner.userId },
        data: { complaintsAssigned: { increment: 1 } },
      }),
    ]);
  }

  await quietly(async () => {
    await notifyComplaintStatusChange(
      complaint.raisedById,
      complaint.title,
      complaint.status,
      ComplaintStatus.ASSIGNED,
      complaintId,
    );
    await notifyComplaintAssignment(facultyId, complaint.title, complaintId);
  });

  return {
    title: complaint.title,
    assigneeName: faculty.name,
    previousAssigneeId: complaint.assignedTo?.id ?? null,
    priority: complaint.priority,
  };
};

/**
 * A super admin moves an escalated complaint to someone else. The status is
 * kept; the complaint is marked as handled by the super admin.
 */
export const reassignEscalated = async (input: {
  complaintId: unknown;
  facultyId: unknown;
  note?: unknown;
  assigner: Assigner;
}) => {
  const { complaintId, facultyId, assigner } = input;
  const note = typeof input.note === "string" && input.note ? input.note : null;
  if (typeof complaintId !== "string" || !complaintId || typeof facultyId !== "string" || !facultyId) {
    throw new ComplaintError("Complaint ID and Faculty ID are required", 400);
  }

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: {
      title: true,
      status: true,
      escalationCount: true,
      assignedToId: true,
      resolutionNote: true,
      raisedById: true,
      assignedTo: { select: { id: true, name: true } },
    },
  });
  if (!complaint) throw new ComplaintError("Complaint not found", 404);
  if ((complaint.escalationCount ?? 0) <= 0) {
    throw new ComplaintError("Only escalated complaints can be reassigned", 400);
  }
  if (complaint.status !== ComplaintStatus.RAISED && complaint.status !== ComplaintStatus.ASSIGNED) {
    throw new ComplaintError("Only RAISED or ASSIGNED escalated complaints can be reassigned", 400);
  }

  const faculty = await loadAssignee(facultyId);

  const previousAssigneeId = complaint.assignedTo?.id ?? complaint.assignedToId ?? null;
  if (previousAssigneeId === facultyId) {
    throw new ComplaintError("Complaint is already assigned to this faculty", 400);
  }

  const entry = buildComplaintAssignmentHistoryEntry({
    fromAssigneeId: previousAssigneeId,
    fromAssigneeName: complaint.assignedTo?.name ?? null,
    toAssigneeId: facultyId,
    toAssigneeName: faculty.name,
    performedById: assigner.userId,
    performedByRole: assigner.role,
    mode: "SUPER_ADMIN",
    note,
  });

  const base: Prisma.ComplaintUpdateInput = {
    assignedTo: { connect: { id: facultyId } },
    assignedAt: new Date(),
    handledBySuperAdmin: true,
    superAdminId: assigner.userId,
    ...(note
      ? {
          resolutionNote: `${complaint.resolutionNote || ""}\n\n[${new Date().toLocaleString()}] SuperAdmin Note: ${note}`,
        }
      : {}),
  };

  try {
    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        ...base,
        assignmentHistory: appendComplaintAssignmentHistory(await readHistory(complaintId), entry),
      },
    });
  } catch (error) {
    if (!isAssignmentHistoryColumnError(error)) throw error;
    await prisma.complaint.update({ where: { id: complaintId }, data: base });
  }

  await quietly(async () => {
    await createNotification({
      userId: complaint.raisedById,
      type: "COMPLAINT_STATUS_UPDATE",
      title: "Complaint Reassigned by Super Admin",
      message: `Your complaint "${complaint.title}" has been reassigned to ${faculty.name} by Super Admin for resolution.`,
      data: { complaintId, newFacultyId: facultyId },
    });
    await notifyComplaintAssignment(facultyId, complaint.title, complaintId);
    if (previousAssigneeId) {
      await createNotification({
        userId: previousAssigneeId,
        type: "COMPLAINT_STATUS_UPDATE",
        title: "Complaint Reassigned",
        message: `Complaint "${complaint.title}" has been reassigned to another faculty member by Super Admin.`,
        data: { complaintId },
      });
    }
  });

  return {
    title: complaint.title,
    assigneeName: faculty.name,
    previousAssigneeId: complaint.assignedToId ?? null,
    escalationCount: complaint.escalationCount,
  };
};
