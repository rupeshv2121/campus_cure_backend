/**
 * Student complaints: raising, intake parsing, duplicates, tracking, and confirming or rejecting a resolution.
 *
 * Split out of studentController.ts by CC-72. Stage 2 moved the business rules for the
 * thin handlers here into services/ (complaints/ or doubts/); they now only
 * translate HTTP in and errors out.
 * See docs/specs/CC-72-controller-split.md.
 */

import type { Response } from "express";
import { prisma } from "../../config/database.js";
import { fileComplaint } from "../../services/complaints/filing.js";
import {
  confirmResolution,
  rejectResolution,
  submitFeedback,
} from "../../services/complaints/lifecycle.js";
import {
  MIN_TEXT_LENGTH,
  parseComplaintText,
} from "../../services/intake/parseComplaint.js";
import { findDuplicateComplaints } from "../../services/search/duplicateComplaints.js";
import { withEvidence } from "../../services/storage/resolutionEvidence.js";
import type { AuthRequest } from "../../types/index.js";
import { answerComplaintError } from "../complaintErrors.js";

// 8. Raise Complaint
export const raiseComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // CC-72: the rules live in services/complaints/filing.ts.
    const complaint = await fileComplaint(req.user!.id, req.body ?? {});

    res.status(201).json({
      message: "Complaint raised successfully - will be manually assigned",
      complaint,
    });
  } catch (error) {
    // A rejected photo is the student's to fix (wrong file, upload never
    // finished); the transaction rolled back, so nothing was filed.
    if (answerComplaintError(res, error)) return;
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
    // CC-72: the rules live in services/complaints/lifecycle.ts.
    await confirmResolution(req.params.complaintId as string, req.user!.id);
    res.json({ message: "Complaint confirmed as resolved" });
  } catch (error) {
    if (answerComplaintError(res, error)) return;
    console.error("confirmComplaintResolution error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 23. Reject Complaint Resolution
export const rejectComplaintResolution = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // CC-72: the rules live in services/complaints/lifecycle.ts.
    await rejectResolution(
      req.params.complaintId as string,
      req.user!.id,
      req.body?.rejectionReason,
    );
    res.json({ message: "Complaint resolution rejected and escalated to Super Admin for review" });
  } catch (error) {
    if (answerComplaintError(res, error)) return;
    console.error("rejectComplaintResolution error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 24. Submit Complaint Feedback (Student)
export const submitComplaintFeedback = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // CC-72: the rules live in services/complaints/lifecycle.ts.
    await submitFeedback(
      req.params.complaintId as string,
      req.user!.id,
      req.body?.feedbackRating,
      req.body?.feedbackComment,
    );
    res.json({ message: "Feedback submitted successfully" });
  } catch (error) {
    if (answerComplaintError(res, error)) return;
    console.error("submitComplaintFeedback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
