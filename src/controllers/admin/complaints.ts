/**
 * Complaint administration: listing, assignment, status, super-admin escalations, duplicates and routing candidates.
 *
 * Split out of adminController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  ComplaintStatus,
  Prisma,
  Role
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  AuditAction,
  auditFromRequest
} from "../../services/audit/auditLog.js";
import { getDuplicateClusters } from "../../services/search/duplicateClusters.js";
import { computeSlaDueAt } from "../../services/sla/policy.js";
import { rankCandidates } from "../../services/staff/routing.js";
import { AttachmentError } from "../../services/storage/attachments.js";
import {
  attachResolutionEvidence,
  withEvidence,
} from "../../services/storage/resolutionEvidence.js";
import type { AuthRequest } from "../../types/index.js";
import {
  appendComplaintAssignmentHistory,
  buildComplaintAssignmentHistoryEntry,
} from "../../utils/complaintAssignmentHistory.js";
import {
  createNotification,
  notifyComplaintAssignment,
  notifyComplaintStatusChange,
} from "../../utils/notifications.js";
import { isAssignmentHistoryColumnError } from "./shared.js";

// 19. Get All Complaints (Admin)
export const getAllComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Return all complaints for the admin complaints view —
    // do not filter by university or hide escalated items.
    const whereClause: any = {};

    const complaints = await prisma.complaint.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        classroomNumber: true,
        block: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignedAt: true,
        handledBySuperAdmin: true,
        superAdminId: true,
        assignmentHistory: true,
        escalationCount: true,
        resolutionNote: true,
        studentRejectionMessage: true,
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            studentProfile: {
              select: {
                enrollmentNumber: true,
                department: true,
                branch: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            facultyProfile: {
              select: {
                department: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // CC-30: admins triage and reassign from this list, so they need the same
    // evidence the faculty member will get.
    res.json({ complaints: await withEvidence(complaints) });
  } catch (error) {
    console.error("Get all complaints error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 21. Assign Complaint to Faculty (Admin)
export const assignComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, facultyId } = req.body;

    if (!complaintId || !facultyId) {
      res
        .status(400)
        .json({ error: "Complaint ID and Faculty ID are required" });
      return;
    }

    // Verify complaint exists
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        title: true,
        status: true,
        raisedById: true,
        // CC-31: the resolution budget depends on it.
        priority: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    // Verify faculty exists and is approved
    const faculty = await prisma.user.findUnique({
      where: { id: facultyId },
      include: { facultyProfile: true },
    });

    if (
      !faculty ||
      faculty.role !== Role.FACULTY ||
      faculty.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      res.status(400).json({ error: "Invalid faculty member" });
      return;
    }

    // Update complaint and admin stats
    const assignmentEntry = buildComplaintAssignmentHistoryEntry({
      fromAssigneeId: complaint.assignedTo?.id ?? null,
      fromAssigneeName: complaint.assignedTo?.name ?? null,
      toAssigneeId: facultyId,
      toAssigneeName: faculty.name,
      performedById: req.user!.id,
      performedByRole: req.user!.role,
      mode: "ADMIN",
    });

    let currentAssignmentHistory: unknown = [];
    try {
      const historyRow = await prisma.complaint.findUnique({
        where: { id: complaintId },
        select: { assignmentHistory: true },
      });
      currentAssignmentHistory = historyRow?.assignmentHistory ?? [];
    } catch (historyError) {
      if (!isAssignmentHistoryColumnError(historyError)) {
        throw historyError;
      }
    }

    const baseComplaintUpdateData = {
      assignedTo: {
        connect: { id: facultyId },
      },
      status: "ASSIGNED" as const,
      assignedAt: new Date(),
      // CC-31: the clock moves from "nobody has picked this up" to "the
      // assignee has not fixed it". Different budget, fresh deadline.
      slaDueAt: computeSlaDueAt(ComplaintStatus.ASSIGNED, complaint.priority),
    };

    const complaintUpdateDataWithHistory = {
      ...baseComplaintUpdateData,
      assignmentHistory: appendComplaintAssignmentHistory(
        currentAssignmentHistory,
        assignmentEntry,
      ),
    };

    try {
      await prisma.$transaction([
        prisma.complaint.update({
          where: { id: complaintId },
          data: complaintUpdateDataWithHistory,
        }),
        prisma.adminProfile.update({
          where: { userId: req.user!.id },
          data: {
            complaintsAssigned: { increment: 1 },
          },
        }),
      ]);
    } catch (updateError) {
      if (!isAssignmentHistoryColumnError(updateError)) {
        throw updateError;
      }

      await prisma.$transaction([
        prisma.complaint.update({
          where: { id: complaintId },
          data: baseComplaintUpdateData,
        }),
        prisma.adminProfile.update({
          where: { userId: req.user!.id },
          data: {
            complaintsAssigned: { increment: 1 },
          },
        }),
      ]);
    }

    // Send notifications
    try {
      // Notify the student who raised the complaint
      await notifyComplaintStatusChange(
        complaint.raisedById,
        complaint.title,
        complaint.status,
        "ASSIGNED",
        complaintId,
      );

      // Notify the faculty member who got assigned
      await notifyComplaintAssignment(facultyId, complaint.title, complaintId);
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    await auditFromRequest(req, {
      action: AuditAction.COMPLAINT_ASSIGN,
      targetType: "Complaint",
      targetId: complaintId,
      summary: `Assigned complaint "${complaint.title}" to ${faculty.name}`,
      metadata: {
        assigneeId: facultyId,
        previousAssigneeId: complaint.assignedTo?.id ?? null,
        priority: complaint.priority,
      },
    });

    res.json({ message: "Complaint assigned successfully" });
  } catch (error) {
    console.error("Assign complaint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 23. Update Complaint Status (Admin)
export const updateComplaintStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, status, resolutionNote, resolutionAttachmentIds } =
      req.body;

    if (!complaintId || !status) {
      res.status(400).json({ error: "Complaint ID and status are required" });
      return;
    }

    // Validate status - include all new statuses
    const validStatuses = [
      "RAISED",
      "ASSIGNED",
      "IN_PROGRESS",
      "PENDING_CONFIRMATION",
      "RESOLVED",
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    // Verify complaint exists
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true }, // Include who raised the complaint for notifications
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.status === "RESOLVED" && status !== "RESOLVED") {
      res.status(400).json({
        error: "Resolved complaints cannot be updated",
      });
      return;
    }

    // Update complaint status
    const updateData: any = {
      status,
    };

    // Add resolution note if status is PENDING_CONFIRMATION or RESOLVED
    if (
      (status === "PENDING_CONFIRMATION" || status === "RESOLVED") &&
      resolutionNote
    ) {
      updateData.resolutionNote = resolutionNote;
    }

    // Set confirmation timing when marking as PENDING_CONFIRMATION.
    if (status === "PENDING_CONFIRMATION") {
      updateData.resolutionDate = new Date();
      updateData.pendingConfirmationAt = new Date();
    } else {
      // Clear stale pending timestamp when moving to other statuses.
      updateData.pendingConfirmationAt = null;
    }

    // CC-31: the deadline follows whoever is actually holding the complaint.
    // PENDING_CONFIRMATION and RESOLVED mean staff are no longer the blocker,
    // so the clock stops - a student who takes a week to confirm must never
    // count as a staff SLA breach.
    updateData.slaDueAt = computeSlaDueAt(
      status as ComplaintStatus,
      complaint.priority,
    );

    try {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: updateData,
      });
    } catch (updateError) {
      // Backward compatibility: retry without pendingConfirmationAt if migration is pending.
      if (
        updateError instanceof Prisma.PrismaClientKnownRequestError &&
        updateError.code === "P2022"
      ) {
        const { pendingConfirmationAt: _ignored, ...fallbackData } = updateData;
        await prisma.complaint.update({
          where: { id: complaintId },
          data: fallbackData,
        });
      } else {
        throw updateError;
      }
    }

    // CC-30: bind the "after" photos now the status change has committed.
    // Same ordering and same reasoning as the faculty handler - see
    // services/storage/resolutionEvidence.ts.
    try {
      await attachResolutionEvidence({
        attachmentIds: resolutionAttachmentIds,
        complaintId,
        userId: req.user!.id,
        status,
      });
    } catch (evidenceError) {
      if (evidenceError instanceof AttachmentError) {
        res.status(evidenceError.status).json({ error: evidenceError.message });
        return;
      }
      throw evidenceError;
    }

    // Send notification for status change
    try {
      if (complaint.status !== status) {
        await notifyComplaintStatusChange(
          complaint.raisedById,
          complaint.title,
          complaint.status,
          status,
          complaintId,
        );
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    // Update admin stats when complaint is resolved
    if (
      status === "RESOLVED" &&
      complaint.status !== "RESOLVED" &&
      complaint.status !== "PENDING_CONFIRMATION"
    ) {
      await prisma.adminProfile.update({
        where: { userId: req.user!.id },
        data: {
          complaintsClosed: { increment: 1 },
        },
      });
    }

    await auditFromRequest(req, {
      action: AuditAction.COMPLAINT_STATUS_CHANGE,
      targetType: "Complaint",
      targetId: complaintId,
      summary: `Complaint status ${complaint.status} -> ${status}`,
      metadata: { from: complaint.status, to: status },
    });

    res.json({ message: "Complaint status updated successfully" });
  } catch (error) {
    console.error("Update complaint status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============ SUPER ADMIN COMPLAINT FUNCTIONS ============

// Get Escalated Complaints (Super Admin Only)
export const getEscalatedComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const escalatedComplaints = await prisma.complaint.findMany({
      where: {
        escalationCount: {
          gt: 0,
        },
        status: {
          not: "RESOLVED",
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        classroomNumber: true,
        block: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        escalationCount: true,
        resolutionNote: true,
        studentRejectionMessage: true,
        assignedAt: true,
        handledBySuperAdmin: true,
        superAdminId: true,
        assignmentHistory: true,
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            studentProfile: {
              select: {
                enrollmentNumber: true,
                department: true,
                branch: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            facultyProfile: {
              select: {
                department: true,
              },
            },
          },
        },
      },
      orderBy: [
        { escalationCount: "desc" }, // Most escalated first
        { createdAt: "desc" },
      ],
    });

    res.json({ complaints: escalatedComplaints });
  } catch (error) {
    console.error("Get escalated complaints error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Reassign Escalated Complaint (Super Admin Only)
export const reassignEscalatedComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, facultyId, superAdminNote } = req.body;

    if (!complaintId || !facultyId) {
      res
        .status(400)
        .json({ error: "Complaint ID and Faculty ID are required" });
      return;
    }

    // Verify complaint exists and is escalated
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        title: true,
        status: true,
        escalationCount: true,
        assignedToId: true,
        resolutionNote: true,
        raisedById: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if ((complaint.escalationCount ?? 0) <= 0) {
      res
        .status(400)
        .json({ error: "Only escalated complaints can be reassigned" });
      return;
    }

    if (complaint.status !== "RAISED" && complaint.status !== "ASSIGNED") {
      res.status(400).json({
        error: "Only RAISED or ASSIGNED escalated complaints can be reassigned",
      });
      return;
    }

    // Verify faculty exists and is approved
    const faculty = await prisma.user.findUnique({
      where: { id: facultyId },
      include: { facultyProfile: true },
    });

    if (
      !faculty ||
      faculty.role !== Role.FACULTY ||
      faculty.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      res.status(400).json({ error: "Invalid faculty member" });
      return;
    }

    const previousAssigneeId =
      complaint.assignedTo?.id ?? complaint.assignedToId ?? null;

    if (previousAssigneeId === facultyId) {
      res
        .status(400)
        .json({ error: "Complaint is already assigned to this faculty" });
      return;
    }

    // Keep existing complaint status; only transfer assignee and add super-admin metadata.
    const assignmentEntry = buildComplaintAssignmentHistoryEntry({
      fromAssigneeId: previousAssigneeId,
      fromAssigneeName: complaint.assignedTo?.name ?? null,
      toAssigneeId: facultyId,
      toAssigneeName: faculty.name,
      performedById: req.user!.id,
      performedByRole: req.user!.role,
      mode: "SUPER_ADMIN",
      note: superAdminNote || null,
    });

    let currentAssignmentHistory: unknown = [];
    try {
      const historyRow = await prisma.complaint.findUnique({
        where: { id: complaintId },
        select: { assignmentHistory: true },
      });
      currentAssignmentHistory = historyRow?.assignmentHistory ?? [];
    } catch (historyError) {
      if (!isAssignmentHistoryColumnError(historyError)) {
        throw historyError;
      }
    }

    const updateData: any = {
      assignedTo: {
        connect: { id: facultyId },
      },
      assignedAt: new Date(),
      handledBySuperAdmin: true,
      superAdminId: req.user!.id,
      assignmentHistory: appendComplaintAssignmentHistory(
        currentAssignmentHistory,
        assignmentEntry,
      ),
    };

    // Add superadmin note to resolution notes
    if (superAdminNote) {
      updateData.resolutionNote = `${complaint.resolutionNote || ""}\n\n[${new Date().toLocaleString()}] SuperAdmin Note: ${superAdminNote}`;
    }

    try {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: updateData,
      });
    } catch (updateError) {
      if (!isAssignmentHistoryColumnError(updateError)) {
        throw updateError;
      }

      const { assignmentHistory: _ignored, ...fallbackUpdateData } = updateData;
      await prisma.complaint.update({
        where: { id: complaintId },
        data: fallbackUpdateData,
      });
    }

    await auditFromRequest(req, {
      action: AuditAction.COMPLAINT_REASSIGN,
      targetType: "Complaint",
      targetId: complaintId,
      summary: `Super Admin reassigned "${complaint.title}" to ${faculty.name}`,
      metadata: {
        assigneeId: facultyId,
        previousAssigneeId: complaint.assignedToId ?? null,
        escalationCount: complaint.escalationCount,
      },
    });

    // Send notifications
    try {
      // Notify the student
      await createNotification({
        userId: complaint.raisedById,
        type: "COMPLAINT_STATUS_UPDATE",
        title: "Complaint Reassigned by Super Admin",
        message: `Your complaint "${complaint.title}" has been reassigned to ${faculty.name} by Super Admin for resolution.`,
        data: { complaintId, newFacultyId: facultyId },
      });

      // Notify the new faculty member
      await notifyComplaintAssignment(facultyId, complaint.title, complaintId);

      // If there was a previous faculty, notify them too
      if (previousAssigneeId && previousAssigneeId !== facultyId) {
        await createNotification({
          userId: previousAssigneeId,
          type: "COMPLAINT_STATUS_UPDATE",
          title: "Complaint Reassigned",
          message: `Complaint "${complaint.title}" has been reassigned to another faculty member by Super Admin.`,
          data: { complaintId },
        });
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      message: "Complaint reassigned successfully by Super Admin",
      assignedTo: faculty.name,
    });
  } catch (error) {
    console.error("Reassign escalated complaint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark Escalated Complaint as Handled (Super Admin takes over)
export const markComplaintAsHandled = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { complaintId, action } = req.body;

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true, assignedTo: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        handledBySuperAdmin: true,
        superAdminId: req.user!.id,
      },
    });

    // Notify student
    try {
      await createNotification({
        userId: complaint.raisedById,
        type: "COMPLAINT_STATUS_UPDATE",
        title: "Complaint Escalated to Super Admin",
        message: `Your complaint "${complaint.title}" is now being handled by Super Admin.`,
        data: { complaintId },
      });
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
    }

    res.json({ message: "Complaint marked as handled by Super Admin" });
  } catch (error) {
    console.error("Mark complaint as handled error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-13: open complaints grouped into likely-duplicate clusters.
 *
 * Read-only by design. Nothing here merges, closes or alters a complaint —
 * merging would destroy the reporter list and is unrecoverable. The admin sees
 * the group and decides.
 */
export const getComplaintDuplicateClusters = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const clusters = await getDuplicateClusters();
    res.json({
      clusters,
      totalClusters: clusters.length,
      totalComplaints: clusters.reduce((sum, c) => sum + c.size, 0),
    });
  } catch (error) {
    console.error("Error building duplicate clusters:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-27: ranked assignment candidates for one complaint.
 *
 * Replaces the flat, name-ordered list from `getApprovedFaculty` at the point
 * where it did the most damage. That endpoint returned every approved faculty
 * member with no indication of who does what, so the admin assigning "broken
 * fan in ML02" had no way to see that one of the eighty names was the
 * electrician.
 *
 * Everyone assignable is still returned, best first — never a filtered list.
 * A wrong `handlesCategories` value must not make a complaint unassignable,
 * and the admin may always overrule the ranking.
 */
export const getAssignmentCandidates = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = String(req.params.complaintId ?? "");

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, category: true, block: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    const candidates = await rankCandidates({
      category: complaint.category,
      // Department is a TIEBREAK only, never a qualification: an electrician
      // from another department still fixes fans better than a nearby
      // lecturer, which is the exact mistake the deleted rules table made.
      department: null,
    });

    res.json({ category: complaint.category, candidates });
  } catch (error) {
    console.error("[CC-27] assignment candidates failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
