/**
 * The complaint lifecycle (CC-72 stage 2).
 *
 *   RAISED -> ASSIGNED -> IN_PROGRESS -> PENDING_CONFIRMATION -> RESOLVED
 *                 ^                              |
 *                 +------ student rejects -------+   (escalation)
 *
 * Every status change used to be written inline in a controller - twice for
 * staff and admin, with small undocumented differences - so "what may move a
 * complaint where, and what else changes when it does" had no single answer.
 * It lives here now, callable and testable without HTTP. Controllers only
 * translate requests in and ComplaintError out.
 *
 * Behaviour is carried over unchanged, except where a comment says otherwise.
 */

import { ComplaintStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import type { RejectionHistoryEntry } from "../../types/index.js";
import {
  createNotification,
  notifyComplaintStatusChange,
} from "../../utils/notifications.js";
import { computeSlaDueAt } from "../sla/policy.js";
import { attachResolutionEvidence } from "../storage/resolutionEvidence.js";

/** A refusal the caller should see, with the HTTP status that fits it. */
export class ComplaintError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ComplaintError";
  }
}

/** Who is changing the status. The rules differ, deliberately. */
export type StatusActor =
  | { kind: "staff"; userId: string }
  | { kind: "admin"; userId: string };

/**
 * Statuses each actor may set. Staff move their own work forward; only an
 * admin can put a complaint back to RAISED/ASSIGNED or close it outright.
 */
export const ALLOWED_TARGETS: Record<StatusActor["kind"], ComplaintStatus[]> = {
  staff: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.PENDING_CONFIRMATION],
  admin: [
    ComplaintStatus.RAISED,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.PENDING_CONFIRMATION,
    ComplaintStatus.RESOLVED,
  ],
};

/**
 * The columns a status change writes. Pure, so the rules are testable on
 * their own.
 *
 * - A resolution note is kept from staff on any move, from an admin only
 *   when resolving (PENDING_CONFIRMATION or RESOLVED) - as before.
 * - Moving to PENDING_CONFIRMATION stamps when the fix was claimed; staff
 *   doing so also clear the super-admin "handled" flag, because a new fix
 *   supersedes the old review. Any other move clears the pending stamp.
 * - CC-31: the SLA clock follows whoever holds the complaint, and stops
 *   while the student is the one who has to act.
 */
export const buildStatusUpdate = (input: {
  actor: StatusActor["kind"];
  to: ComplaintStatus;
  priority: number;
  resolutionNote?: string | undefined;
  now?: Date;
}): Prisma.ComplaintUpdateInput => {
  const now = input.now ?? new Date();
  const data: Prisma.ComplaintUpdateInput = { status: input.to };

  const resolving =
    input.to === ComplaintStatus.PENDING_CONFIRMATION ||
    input.to === ComplaintStatus.RESOLVED;
  if (input.resolutionNote && (input.actor === "staff" || resolving)) {
    data.resolutionNote = input.resolutionNote;
  }

  if (input.to === ComplaintStatus.PENDING_CONFIRMATION) {
    data.resolutionDate = now;
    data.pendingConfirmationAt = now;
    if (input.actor === "staff") data.handledBySuperAdmin = false;
  } else {
    data.pendingConfirmationAt = null;
  }

  data.slaDueAt = computeSlaDueAt(input.to, input.priority, now);
  return data;
};

/**
 * Write a status change. A database whose migration for
 * `pendingConfirmationAt` has not run (P2022, unknown column) gets the same
 * change without that column, as both controllers already allowed.
 */
const writeStatus = async (complaintId: string, data: Prisma.ComplaintUpdateInput) => {
  try {
    await prisma.complaint.update({ where: { id: complaintId }, data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2022"
    ) {
      const { pendingConfirmationAt: _ignored, ...fallback } = data;
      await prisma.complaint.update({ where: { id: complaintId }, data: fallback });
      return;
    }
    throw error;
  }
};

/** Notifications never fail the action that caused them. */
const quietly = async (label: string, send: () => Promise<unknown>) => {
  try {
    await send();
  } catch (error) {
    console.error(`[complaints] ${label} notification failed:`, error);
  }
};

/**
 * Change a complaint's status as staff or admin.
 *
 * Throws ComplaintError for anything the caller got wrong, and lets
 * AttachmentError from the resolution photos through for the controller to
 * map. Returns the move made, for the caller's audit entry.
 */
export const changeComplaintStatus = async (input: {
  complaintId: string;
  to: unknown;
  resolutionNote?: string | undefined;
  resolutionAttachmentIds?: unknown;
  actor: StatusActor;
}): Promise<{ from: ComplaintStatus; to: ComplaintStatus }> => {
  const { complaintId, actor } = input;

  if (!complaintId || !input.to) {
    throw new ComplaintError("Complaint ID and status are required", 400);
  }

  const to = input.to as ComplaintStatus;
  if (!ALLOWED_TARGETS[actor.kind].includes(to)) {
    throw new ComplaintError(
      actor.kind === "staff"
        ? "Faculty can only update status to IN_PROGRESS or PENDING_CONFIRMATION"
        : "Invalid status",
      400,
    );
  }

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: {
      status: true,
      priority: true,
      assignedToId: true,
      raisedById: true,
      title: true,
    },
  });
  if (!complaint) throw new ComplaintError("Complaint not found", 404);

  if (actor.kind === "staff" && complaint.assignedToId !== actor.userId) {
    throw new ComplaintError(
      "This complaint is assigned to another faculty member",
      403,
    );
  }

  // An admin may re-save RESOLVED (e.g. to add a note); nobody may reopen it.
  if (
    complaint.status === ComplaintStatus.RESOLVED &&
    (actor.kind === "staff" || to !== ComplaintStatus.RESOLVED)
  ) {
    throw new ComplaintError("Resolved complaints cannot be updated", 400);
  }

  await writeStatus(
    complaintId,
    buildStatusUpdate({
      actor: actor.kind,
      to,
      priority: complaint.priority,
      resolutionNote: input.resolutionNote,
    }),
  );

  // CC-30: the "after" photos, bound once the status has committed. A
  // transaction held open across storage's latency is worse than a photo
  // the nightly sweep collects if this fails. See resolutionEvidence.ts.
  await attachResolutionEvidence({
    attachmentIds: input.resolutionAttachmentIds,
    complaintId,
    userId: actor.userId,
    status: to,
  });

  if (complaint.status !== to) {
    await quietly("status change", () =>
      notifyComplaintStatusChange(
        complaint.raisedById,
        complaint.title,
        complaint.status,
        to,
        complaintId,
      ),
    );
  }

  // An admin closing a complaint directly counts toward their tally; one
  // that was already awaiting the student does not, since staff fixed it.
  if (
    actor.kind === "admin" &&
    to === ComplaintStatus.RESOLVED &&
    complaint.status !== ComplaintStatus.RESOLVED &&
    complaint.status !== ComplaintStatus.PENDING_CONFIRMATION
  ) {
    await prisma.adminProfile.update({
      where: { userId: actor.userId },
      data: { complaintsClosed: { increment: 1 } },
    });
  }

  return { from: complaint.status, to };
};

/** Load a complaint the student owns that is waiting for their verdict. */
const loadForVerdict = async (complaintId: string, studentId: string, verb: string) => {
  if (!complaintId) throw new ComplaintError("Complaint ID is required", 400);

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: {
      status: true,
      title: true,
      raisedById: true,
      assignedToId: true,
      resolutionNote: true,
      rejectionHistory: true,
      raisedBy: { select: { name: true } },
    },
  });
  if (!complaint) throw new ComplaintError("Complaint not found", 404);
  if (complaint.raisedById !== studentId) {
    throw new ComplaintError(`You can only ${verb} your own complaints`, 403);
  }
  if (complaint.status !== ComplaintStatus.PENDING_CONFIRMATION) {
    throw new ComplaintError("Complaint is not pending your approval", 400);
  }
  return complaint;
};

/**
 * Write a verdict only if the complaint is STILL pending.
 *
 * Changed in CC-72: both verdicts used to check the status and then write
 * unconditionally, so two requests in flight together (a double tap) could
 * both pass the check - and a double rejection escalated twice.
 */
const writeVerdict = async (complaintId: string, data: Prisma.ComplaintUpdateManyMutationInput) => {
  const { count } = await prisma.complaint.updateMany({
    where: { id: complaintId, status: ComplaintStatus.PENDING_CONFIRMATION },
    data,
  });
  if (count === 0) {
    throw new ComplaintError("Complaint is not pending your approval", 409);
  }
};

/** The student agrees the fix worked. */
export const confirmResolution = async (complaintId: string, studentId: string) => {
  const complaint = await loadForVerdict(complaintId, studentId, "confirm");

  await writeVerdict(complaintId, {
    status: ComplaintStatus.RESOLVED,
    studentConfirmed: true,
    studentConfirmationDate: new Date(),
    handledBySuperAdmin: false,
  });

  await quietly("confirmation", async () => {
    if (complaint.assignedToId) {
      await notifyComplaintStatusChange(
        complaint.assignedToId,
        complaint.title,
        complaint.status,
        ComplaintStatus.RESOLVED,
        complaintId,
      );
    }

    const admins = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true },
      select: { id: true },
    });
    for (const admin of admins) {
      await notifyComplaintStatusChange(
        admin.id,
        complaint.title,
        complaint.status,
        ComplaintStatus.RESOLVED,
        complaintId,
      );
    }
  });
};

/** Read the rejection history however it was stored (JSON column or string). */
export const parseRejectionHistory = (stored: unknown): RejectionHistoryEntry[] => {
  if (Array.isArray(stored)) return stored as RejectionHistoryEntry[];
  if (typeof stored === "string") {
    try {
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as RejectionHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * The student says the fix did not work. The complaint goes back to its
 * assignee (or the queue), counts an escalation, and super admins are told.
 */
export const rejectResolution = async (
  complaintId: string,
  studentId: string,
  rejectionReason: unknown,
) => {
  if (typeof rejectionReason !== "string" || rejectionReason.trim() === "") {
    throw new ComplaintError("Rejection reason is required", 400);
  }

  const complaint = await loadForVerdict(complaintId, studentId, "reject");
  const now = new Date();

  const history = parseRejectionHistory(complaint.rejectionHistory);
  history.push({
    timestamp: now.toISOString(),
    reason: rejectionReason,
    studentName: complaint.raisedBy.name,
  });

  const backTo = complaint.assignedToId
    ? ComplaintStatus.ASSIGNED
    : ComplaintStatus.RAISED;

  await writeVerdict(complaintId, {
    status: backTo,
    studentRejectionMessage: rejectionReason,
    escalationCount: { increment: 1 },
    rejectionHistory: history as unknown as Prisma.InputJsonValue,
    resolutionNote: `${complaint.resolutionNote || ""}\n\n[${now.toLocaleString()}] Student Rejection: ${rejectionReason}`,
  });

  const { escalationCount } = await prisma.complaint.findUniqueOrThrow({
    where: { id: complaintId },
    select: { escalationCount: true },
  });

  await quietly("rejection", async () => {
    if (complaint.assignedToId) {
      await notifyComplaintStatusChange(
        complaint.assignedToId,
        complaint.title,
        complaint.status,
        backTo,
        complaintId,
      );
    }

    const superAdmins = await prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN, isActive: true },
      select: { id: true },
    });
    for (const superAdmin of superAdmins) {
      await createNotification({
        userId: superAdmin.id,
        type: "COMPLAINT_STATUS_UPDATE",
        title: "Complaint Rejected by Student - Escalated",
        message: `Complaint "${complaint.title}" was rejected by student ${complaint.raisedBy.name}. Reason: ${rejectionReason}`,
        data: {
          complaintId,
          oldStatus: complaint.status,
          newStatus: backTo,
          rejectionReason,
          escalationCount,
          escalatedForSuperAdminReview: true,
        },
      });
    }
  });
};

/** Validate a 1-5 rating and an optional comment of at most 1,000 characters. */
export const validateFeedback = (rating: unknown, comment: unknown) => {
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ComplaintError("Feedback rating must be an integer between 1 and 5", 400);
  }
  if (comment !== undefined && comment !== null && typeof comment !== "string") {
    throw new ComplaintError("Feedback comment must be a string", 400);
  }
  const normalised = typeof comment === "string" ? comment.trim() : "";
  if (normalised.length > 1000) {
    throw new ComplaintError("Feedback comment is too long", 400);
  }
  return { rating, comment: normalised || null };
};

/** The student rates a resolved complaint, once. */
export const submitFeedback = async (
  complaintId: string,
  studentId: string,
  rating: unknown,
  comment: unknown,
) => {
  if (!complaintId) throw new ComplaintError("Complaint ID is required", 400);
  const feedback = validateFeedback(rating, comment);

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: { raisedById: true, status: true, feedbackRating: true },
  });
  if (!complaint) throw new ComplaintError("Complaint not found", 404);
  if (complaint.raisedById !== studentId) {
    throw new ComplaintError("You can only submit feedback for your own complaints", 403);
  }
  if (complaint.status !== ComplaintStatus.RESOLVED) {
    throw new ComplaintError("Feedback can only be submitted after complaint is resolved", 400);
  }
  if (complaint.feedbackRating !== null) {
    throw new ComplaintError("Feedback already submitted for this complaint", 400);
  }

  // Conditional for the same reason as the verdicts: two submissions racing
  // must not both land.
  const { count } = await prisma.complaint.updateMany({
    where: { id: complaintId, feedbackRating: null },
    data: { feedbackRating: feedback.rating, feedbackComment: feedback.comment },
  });
  if (count === 0) {
    throw new ComplaintError("Feedback already submitted for this complaint", 400);
  }
};
