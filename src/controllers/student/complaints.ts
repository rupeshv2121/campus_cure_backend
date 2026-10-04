/**
 * Student complaints: raising, intake parsing, duplicates, tracking, and confirming or rejecting a resolution.
 *
 * Split out of studentController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  AttachmentEntity,
  Prisma,
  Role
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  requestEmbedding,
  triggerDrainInBackground,
} from "../../services/ai/embeddingWorker.js";
import {
  MIN_TEXT_LENGTH,
  parseComplaintText,
} from "../../services/intake/parseComplaint.js";
import { findDuplicateComplaints } from "../../services/search/duplicateComplaints.js";
import { initialSlaDueAt } from "../../services/sla/policy.js";
import {
  AttachmentError,
  confirmAttachments
} from "../../services/storage/attachments.js";
import { withEvidence } from "../../services/storage/resolutionEvidence.js";
import type { AuthRequest, RejectionHistoryEntry } from "../../types/index.js";
import {
  createNotification,
  notifyComplaintStatusChange,
} from "../../utils/notifications.js";
import { getPostingSettings } from "./shared.js";

// 8. Raise Complaint
export const raiseComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      title,
      description,
      category,
      priority,
      classroomNumber,
      block,
      attachmentIds,
    } = req.body;

    if (
      !title ||
      !description ||
      !category ||
      !priority ||
      !classroomNumber ||
      !block
    ) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    const { allowedCategories } = await getPostingSettings();
    if (!allowedCategories.includes(String(category))) {
      res.status(400).json({
        error: "Selected complaint category is not allowed",
      });
      return;
    }

    console.log("Raising complaint with data:", {
      title,
      description,
      category,
      priority,
      classroomNumber,
      block,
    });

    // Create complaint and update student profile counters in a transaction.
    //
    // CC-02: interactive rather than the array form, because confirming
    // attachments needs the complaint's id and must commit with it. A complaint
    // that fails to write must not leave files claiming to belong to it.
    const complaint = await prisma.$transaction(async (tx) => {
      const created = await tx.complaint.create({
        data: {
          title,
          description,
          category,
          priority,
          classroomNumber,
          block,
          // CC-31: the clock starts the moment it is filed. Assignment budget,
          // because until someone assigns it an admin is the one holding it.
          slaDueAt: initialSlaDueAt(Number(priority)),
          raisedBy: { connect: { id: req.user!.id } },
        },
      });

      await tx.studentProfile.update({
        where: { userId: req.user!.id },
        data: {
          totalComplaints: { increment: 1 },
          totalActiveComplaints: { increment: 1 },
        },
      });

      if (Array.isArray(attachmentIds) && attachmentIds.length > 0) {
        await confirmAttachments({
          attachmentIds,
          entityType: AttachmentEntity.COMPLAINT,
          entityId: created.id,
          userId: req.user!.id,
          tx,
        });
      }

      return created;
    });

    // CC-13: queue for embedding so this complaint can be matched against
    // future reports. Never inline - an AI outage must not block filing.
    await requestEmbedding("complaint", complaint.id);
    triggerDrainInBackground();

    res.status(201).json({
      message: "Complaint raised successfully - will be manually assigned",
      complaint,
    });
  } catch (error) {
    // CC-02: a rejected attachment is the student's problem to fix (wrong file,
    // upload never finished), not a server fault. The transaction has already
    // rolled back, so no complaint was filed.
    if (error instanceof AttachmentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    console.error("Error raising complaint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-14: turn a free-text complaint into structured fields.
 *
 * Read-only and advisory. The result is shown to the student for confirmation
 * before anything is filed — this never categorises silently, and the full form
 * remains available behind it.
 */
export const parseComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { text } = req.body as { text?: unknown };

    if (typeof text !== "string" || text.trim().length < MIN_TEXT_LENGTH) {
      res.json({
        category: null,
        priority: null,
        block: null,
        classroomNumber: null,
        source: "none",
      });
      return;
    }

    res.json(await parseComplaintText(text));
  } catch (error) {
    console.error("Error parsing complaint:", error);
    // Advisory: degrade to "no suggestion" rather than blocking the form.
    res.json({
      category: null,
      priority: null,
      block: null,
      classroomNumber: null,
      source: "none",
    });
  }
};

/**
 * CC-13: pre-submit duplicate check.
 *
 * Advisory only. It never blocks filing, and returns an empty list whenever
 * detection is unavailable - a student must always be able to report a problem.
 */
export const getSimilarComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const str = (value: unknown) =>
      typeof value === "string" ? value.trim() : "";

    const title = str(req.query.title);
    const description = str(req.query.description);
    const block = str(req.query.block);
    const classroomNumber = str(req.query.classroomNumber);

    if (!block || !classroomNumber || (title + description).length < 5) {
      res.json({ duplicates: [] });
      return;
    }

    const duplicates = await findDuplicateComplaints({
      title,
      description,
      block,
      classroomNumber,
      limit: 3,
    });

    res.json({ duplicates });
  } catch (error) {
    console.error("Error checking similar complaints:", error);
    // Advisory feature: degrade to "none found" rather than failing the page.
    res.json({ duplicates: [] });
  }
};

// 9. Get All Complaints for student
export const getComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Return only the current student's complaints for My Complaints view
    const complaints = await prisma.complaint.findMany({
      where: { raisedById: req.user!.id },
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
        resolutionNote: true,
        studentConfirmed: true,
        studentConfirmationDate: true,
        feedbackRating: true,
        feedbackComment: true,
        studentRejectionMessage: true,
        escalationCount: true,
        // CC-31: so a student can see when their complaint is due, without
        // the frontend reimplementing the policy.
        slaDueAt: true,
        assignmentHistory: true,
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
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
      orderBy: { createdAt: "desc" },
    });

    // CC-02: evidence photos, batched into one query rather than one per
    // complaint. No signed URLs here — those are minted per view by
    // GET /api/attachments/:id, because a URL baked into this list would be
    // expired by the time anyone clicked it.
    // CC-30: both halves of the before/after pair, batched.
    //
    // The resolution photos matter most on THIS screen: it is where the
    // student is asked to confirm or reject a fix, and "does the photo show a
    // working fan" is a better basis for that decision than a one-line note
    // saying it was fixed.
    res.json({ complaints: await withEvidence(complaints) });
  } catch (e) {
    console.error("Error fetching complaints:", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 22. Confirm Complaint Resolution
export const confirmComplaintResolution = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;

    console.log("Confirming resolution for complaint:", complaintId);

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    // Verify complaint exists and belongs to the student
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { assignedTo: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.raisedById !== req.user!.id) {
      res
        .status(403)
        .json({ error: "You can only confirm your own complaints" });
      return;
    }

    if (complaint.status !== "PENDING_CONFIRMATION") {
      res.status(400).json({
        error: "Complaint is not pending your approval",
      });
      return;
    }

    // Update complaint to RESOLVED and mark as confirmed
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: "RESOLVED",
        studentConfirmed: true,
        studentConfirmationDate: new Date(),
        handledBySuperAdmin: false, // Reset superadmin handling flag
      },
    });

    console.log("Complaint confirmed successfully:", updatedComplaint.id);

    // Send notification to the assigned faculty and admin
    try {
      if (complaint.assignedTo) {
        await notifyComplaintStatusChange(
          complaint.assignedToId!,
          complaint.title,
          complaint.status,
          "RESOLVED",
          complaintId,
        );
        console.log("Confirmation notification sent to faculty");
      }

      // Notify admin that complaint is resolved
      const admins = await prisma.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
          isActive: true,
        },
        select: { id: true },
      });

      for (const admin of admins) {
        await notifyComplaintStatusChange(
          admin.id,
          complaint.title,
          complaint.status,
          "RESOLVED",
          complaintId,
        );
      }
    } catch (notificationError) {
      console.error("Notification error (non-blocking):", notificationError);
      // Don't fail the request if notifications fail
    }

    console.log("Sending confirmation success response");
    res.json({ message: "Complaint confirmed as resolved" });
  } catch (error) {
    console.error("Confirm complaint resolution error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 23. Reject Complaint Resolution
export const rejectComplaintResolution = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;
    const { rejectionReason } = req.body;

    console.log(
      "Rejecting resolution for complaint:",
      complaintId,
      "Reason:",
      rejectionReason,
    );

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    if (!rejectionReason || rejectionReason.trim() === "") {
      res.status(400).json({ error: "Rejection reason is required" });
      return;
    }

    // Verify complaint exists and belongs to the student
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { assignedTo: true, raisedBy: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.raisedById !== req.user!.id) {
      res
        .status(403)
        .json({ error: "You can only reject your own complaints" });
      return;
    }

    if (complaint.status !== "PENDING_CONFIRMATION") {
      res.status(400).json({
        error: "Complaint is not pending your approval",
      });
      return;
    }

    // Parse existing rejection history
    let rejectionHistory: RejectionHistoryEntry[] = [];
    try {
      rejectionHistory =
        typeof complaint.rejectionHistory === "string"
          ? JSON.parse(complaint.rejectionHistory)
          : Array.isArray(complaint.rejectionHistory)
            ? complaint.rejectionHistory
            : [];
    } catch {
      rejectionHistory = [];
    }

    // Add new rejection to history
    rejectionHistory.push({
      timestamp: new Date().toISOString(),
      reason: rejectionReason,
      studentName: complaint.raisedBy.name,
    });

    const escalatedStatus = complaint.assignedToId ? "ASSIGNED" : "RAISED";

    // Flag complaint for Super Admin re-review using escalation count.
    const updatedComplaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: escalatedStatus,
        studentRejectionMessage: rejectionReason,
        escalationCount: { increment: 1 },
        rejectionHistory: rejectionHistory as unknown as Prisma.InputJsonValue,
        resolutionNote: rejectionReason
          ? `${complaint.resolutionNote || ""}\n\n[${new Date().toLocaleString()}] Student Rejection: ${rejectionReason}`
          : complaint.resolutionNote,
      },
    });

    console.log("Complaint rejected and escalated:", updatedComplaint.id);

    // Send notifications
    try {
      // Notify the assigned faculty about rejection
      if (complaint.assignedTo) {
        await notifyComplaintStatusChange(
          complaint.assignedToId!,
          complaint.title,
          complaint.status,
          escalatedStatus,
          complaintId,
        );
        console.log("Notification sent to faculty");
      }

      // Notify all superadmins about the escalation
      const superAdmins = await prisma.user.findMany({
        where: {
          role: Role.SUPER_ADMIN,
          isActive: true,
        },
        select: { id: true },
      });

      console.log(`Found ${superAdmins.length} superadmins to notify`);

      for (const superAdmin of superAdmins) {
        await createNotification({
          userId: superAdmin.id,
          type: "COMPLAINT_STATUS_UPDATE",
          title: "Complaint Rejected by Student - Escalated",
          message: `Complaint "${complaint.title}" was rejected by student ${complaint.raisedBy.name}. Reason: ${rejectionReason}`,
          data: {
            complaintId,
            oldStatus: complaint.status,
            newStatus: escalatedStatus,
            rejectionReason,
            escalationCount: updatedComplaint.escalationCount,
            escalatedForSuperAdminReview: true,
          },
        });
      }

      console.log("Escalation notifications sent to superadmins");
    } catch (notificationError) {
      console.error("Notification error (non-blocking):", notificationError);
      // Don't fail the request if notification fails
    }

    console.log("Sending success response");
    res.json({
      message:
        "Complaint resolution rejected and escalated to Super Admin for review",
    });
  } catch (error) {
    console.error("Reject complaint resolution error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 24. Submit Complaint Feedback (Student)
export const submitComplaintFeedback = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;
    const { feedbackRating, feedbackComment } = req.body as {
      feedbackRating?: unknown;
      feedbackComment?: unknown;
    };

    if (!complaintId) {
      res.status(400).json({ error: "Complaint ID is required" });
      return;
    }

    if (
      typeof feedbackRating !== "number" ||
      !Number.isInteger(feedbackRating) ||
      feedbackRating < 1 ||
      feedbackRating > 5
    ) {
      res
        .status(400)
        .json({ error: "Feedback rating must be an integer between 1 and 5" });
      return;
    }

    if (
      feedbackComment !== undefined &&
      feedbackComment !== null &&
      typeof feedbackComment !== "string"
    ) {
      res.status(400).json({ error: "Feedback comment must be a string" });
      return;
    }

    const normalizedFeedbackComment =
      typeof feedbackComment === "string" ? feedbackComment.trim() : "";

    if (normalizedFeedbackComment.length > 1000) {
      res.status(400).json({ error: "Feedback comment is too long" });
      return;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        raisedById: true,
        status: true,
        feedbackRating: true,
      },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.raisedById !== req.user!.id) {
      res.status(403).json({
        error: "You can only submit feedback for your own complaints",
      });
      return;
    }

    if (complaint.status !== "RESOLVED") {
      res.status(400).json({
        error: "Feedback can only be submitted after complaint is resolved",
      });
      return;
    }

    if (complaint.feedbackRating !== null) {
      res
        .status(400)
        .json({ error: "Feedback already submitted for this complaint" });
      return;
    }

    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        feedbackRating,
        feedbackComment: normalizedFeedbackComment || null,
      },
    });

    res.json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error("Submit complaint feedback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
