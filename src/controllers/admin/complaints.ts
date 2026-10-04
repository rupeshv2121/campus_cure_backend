/**
 * Complaint administration: listing, assignment, status, super-admin escalations, duplicates and routing candidates.
 *
 * Split out of adminController.ts by CC-72. Stage 2 moved the business rules for the
 * thin handlers here into services/ (complaints/ or doubts/); they now only
 * translate HTTP in and errors out.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  Role
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  AuditAction,
  auditFromRequest
} from "../../services/audit/auditLog.js";
import {
  assignComplaint as assignComplaintToStaff,
  reassignEscalated,
} from "../../services/complaints/assignment.js";
import { changeComplaintStatus } from "../../services/complaints/lifecycle.js";
import { getDuplicateClusters } from "../../services/search/duplicateClusters.js";
import { rankCandidates } from "../../services/staff/routing.js";
import {
  withEvidence
} from "../../services/storage/resolutionEvidence.js";
import type { AuthRequest } from "../../types/index.js";
import {
  createNotification
} from "../../utils/notifications.js";
import { answerComplaintError } from "../complaintErrors.js";

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

    // CC-72: the rules live in services/complaints/assignment.ts.
    const done = await assignComplaintToStaff({
      complaintId,
      facultyId,
      assigner: { userId: req.user!.id, role: req.user!.role as Role },
    });

    await auditFromRequest(req, {
      action: AuditAction.COMPLAINT_ASSIGN,
      targetType: "Complaint",
      targetId: complaintId,
      summary: `Assigned complaint "${done.title}" to ${done.assigneeName}`,
      metadata: {
        assigneeId: facultyId,
        previousAssigneeId: done.previousAssigneeId,
        priority: done.priority,
      },
    });

    res.json({ message: "Complaint assigned successfully" });
  } catch (error) {
    if (answerComplaintError(res, error)) return;
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

    // CC-72: the rules live in services/complaints/lifecycle.ts.
    const move = await changeComplaintStatus({
      complaintId,
      to: status,
      resolutionNote,
      resolutionAttachmentIds,
      actor: { kind: "admin", userId: req.user!.id },
    });

    await auditFromRequest(req, {
      action: AuditAction.COMPLAINT_STATUS_CHANGE,
      targetType: "Complaint",
      targetId: complaintId,
      summary: `Complaint status ${move.from} -> ${move.to}`,
      metadata: { from: move.from, to: move.to },
    });

    res.json({ message: "Complaint status updated successfully" });
  } catch (error) {
    if (answerComplaintError(res, error)) return;
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

    // CC-72: the rules live in services/complaints/assignment.ts.
    const done = await reassignEscalated({
      complaintId,
      facultyId,
      note: superAdminNote,
      assigner: { userId: req.user!.id, role: req.user!.role as Role },
    });

    await auditFromRequest(req, {
      action: AuditAction.COMPLAINT_REASSIGN,
      targetType: "Complaint",
      targetId: complaintId,
      summary: `Super Admin reassigned "${done.title}" to ${done.assigneeName}`,
      metadata: {
        assigneeId: facultyId,
        previousAssigneeId: done.previousAssigneeId,
        escalationCount: done.escalationCount,
      },
    });

    res.json({
      message: "Complaint reassigned successfully by Super Admin",
      assignedTo: done.assigneeName,
    });
  } catch (error) {
    if (answerComplaintError(res, error)) return;
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
