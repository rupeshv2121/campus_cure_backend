import { ComplaintStatus, ApprovalStatus, DoubtStatus, Prisma, Role } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { generateDraftForDoubt } from "../services/ai/answerDraft.js";
import type { AuthRequest } from "../types/index.js";
import { computeSlaDueAt } from "../services/sla/policy.js";
import {
  ROUTABLE_CATEGORIES,
  isRoutableCategory,
  listDirectory,
  rankCandidates,
} from "../services/staff/routing.js";
import { AttachmentError } from "../services/storage/attachments.js";
import {
  attachResolutionEvidence,
  withEvidence,
} from "../services/storage/resolutionEvidence.js";
import {
  ReputationReason,
  awardReputation,
} from "../services/reputation/reputation.js";
import {
  notifyComplaintStatusChange,
  notifyDoubtAnswer,
} from "../utils/notifications.js";

const isTenDigitPhoneNumber = (value: unknown): boolean =>
  typeof value === "string" && /^\d{10}$/.test(value.trim());

const isDoubtUpvoteSchemaMissingError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
};

// 1. Create Faculty Profile
export const createFacultyProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, department, branch, phoneNumber, address, subjects } =
      req.body;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    // Validate user exists, has correct role, and is pending
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.role !== Role.FACULTY) {
      res.status(400).json({ error: "User is not faculty" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.facultyProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Faculty profile already exists" });
      return;
    }

    const profile = await prisma.facultyProfile.create({
      data: {
        userId,
        department: department || "",
        branch: branch || "",
        phoneNumber: phoneNumber || "",
        address: address || "",
        isTeaching:
          req.body.isTeaching !== undefined ? req.body.isTeaching : true,
        subjects: subjects || [],
        doubtsSolved: 0,
      },
    });

    // Approve the user after profile creation
    await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    res.status(201).json({
      message: "Faculty profile created successfully. You can now login.",
      profile,
    });
  } catch (error) {
    console.error("Create faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 2. Get Faculty Profile
export const getFacultyProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const profile = await prisma.facultyProfile.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            userID: true,
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ error: "Faculty profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 3. Update Faculty Profile
export const updateFacultyProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      department,
      branch,
      phoneNumber,
      address,
      subjects,
      isTeaching,
      // CC-27
      staffRole,
      handlesCategories,
      directoryOptIn,
    } = req.body;

    const data: {
      department?: string;
      branch?: string;
      phoneNumber?: string;
      address?: string;
      subjects?: string[];
      isTeaching?: boolean;
      staffRole?: string | null;
      handlesCategories?: string[];
      directoryOptIn?: boolean;
    } = {};

    if (department !== undefined) {
      data.department = String(department).trim();
    }

    if (branch !== undefined) {
      data.branch = String(branch).trim();
    }

    if (phoneNumber !== undefined) {
      const normalizedPhoneNumber = String(phoneNumber).trim();
      if (
        normalizedPhoneNumber.length > 0 &&
        !isTenDigitPhoneNumber(normalizedPhoneNumber)
      ) {
        res
          .status(400)
          .json({ error: "Phone number must be exactly 10 digits" });
        return;
      }

      data.phoneNumber = normalizedPhoneNumber;
    }

    if (address !== undefined) {
      data.address = String(address).trim();
    }

    if (subjects !== undefined) {
      if (Array.isArray(subjects)) {
        data.subjects = subjects
          .map((subject) => String(subject).trim())
          .filter((subject) => subject.length > 0);
      } else if (typeof subjects === "string") {
        data.subjects = subjects
          .split(",")
          .map((subject) => subject.trim())
          .filter((subject) => subject.length > 0);
      } else {
        res.status(400).json({
          error: "Subjects must be an array or comma-separated string",
        });
        return;
      }
    }

    if (isTeaching !== undefined) {
      if (typeof isTeaching === "boolean") {
        data.isTeaching = isTeaching;
      } else if (isTeaching === "true" || isTeaching === "false") {
        data.isTeaching = isTeaching === "true";
      } else {
        res.status(400).json({ error: "isTeaching must be a boolean" });
        return;
      }
    }

    // CC-27: what this person is. Display only - routing never reads it,
    // because free text cannot be checked.
    if (staffRole !== undefined) {
      const trimmed = String(staffRole).trim().slice(0, 80);
      data.staffRole = trimmed.length > 0 ? trimmed : null;
    }

    // CC-27: what this person actually handles. THE routing field, so unlike
    // staffRole every value is validated against CC-14's vocabulary - an
    // unrecognised category here would be a silent routing dead end, matching
    // nothing and explaining nothing.
    if (handlesCategories !== undefined) {
      if (!Array.isArray(handlesCategories)) {
        res
          .status(400)
          .json({ error: "handlesCategories must be an array" });
        return;
      }

      const normalized = [
        ...new Set(handlesCategories.map((entry) => String(entry).trim().toUpperCase())),
      ];
      const unknown = normalized.filter((entry) => !isRoutableCategory(entry));

      if (unknown.length > 0) {
        res.status(400).json({
          error:
            `Unknown complaint categories: ${unknown.join(", ")}. ` +
            `Allowed: ${ROUTABLE_CATEGORIES.join(", ")}`,
        });
        return;
      }

      data.handlesCategories = normalized;
    }

    // CC-27: consent, and only the subject may give it. There is no admin
    // route that sets this for someone else - that is the whole difference
    // between a staff directory and the student people-finder the roadmap cut.
    if (directoryOptIn !== undefined) {
      if (typeof directoryOptIn === "boolean") {
        data.directoryOptIn = directoryOptIn;
      } else if (directoryOptIn === "true" || directoryOptIn === "false") {
        data.directoryOptIn = directoryOptIn === "true";
      } else {
        res.status(400).json({ error: "directoryOptIn must be a boolean" });
        return;
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "No valid fields provided for update" });
      return;
    }

    const profile = await prisma.facultyProfile.update({
      where: { userId: req.user!.id },
      data,
    });

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Faculty profile not found" });
      return;
    }

    console.error("Update faculty profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 4. Get Complaints Assigned to Faculty
export const assignedComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const facultyId = req.user!.id;

    // Show complaints assigned to this faculty currently or at any point in assignment history.
    const complaints = await prisma.complaint.findMany({
      where: {
        OR: [
          { assignedToId: facultyId },
          {
            assignmentHistory: {
              array_contains: [{ fromAssigneeId: facultyId }],
            },
          },
        ],
      },
      include: {
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

    // CC-30: the photograph is the point. A faculty member assigned "the
    // third-row chair in ML02 is broken" previously had the text and nothing
    // else, which is precisely the round trip this feature removes.
    res.json({ complaints: await withEvidence(complaints) });
  } catch (error) {
    console.error("Get assigned complaints error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Complaint Status (Faculty only - can update to IN_PROGRESS or PENDING_CONFIRMATION)
export const updateComplaintStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;
    const { status, resolutionNote, resolutionAttachmentIds } = req.body;

    if (!complaintId || !status) {
      res.status(400).json({ error: "Complaint ID and status are required" });
      return;
    }

    // Faculty can only move to IN_PROGRESS or PENDING_CONFIRMATION
    const validFacultyStatuses = ["IN_PROGRESS", "PENDING_CONFIRMATION"];
    if (!validFacultyStatuses.includes(status)) {
      res.status(400).json({
        error:
          "Faculty can only update status to IN_PROGRESS or PENDING_CONFIRMATION",
      });
      return;
    }

    // Verify complaint exists and is assigned to this faculty
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { raisedBy: true },
    });

    if (!complaint) {
      res.status(404).json({ error: "Complaint not found" });
      return;
    }

    if (complaint.assignedToId !== req.user!.id) {
      res.status(403).json({
        error: "This complaint is assigned to another faculty member",
      });
      return;
    }

    if (complaint.status === "RESOLVED") {
      res.status(400).json({
        error: "Resolved complaints cannot be updated",
      });
      return;
    }

    // Update complaint status
    const updateData: any = {
      status,
    };

    // Add resolution note if provided
    if (resolutionNote) {
      updateData.resolutionNote = resolutionNote;
    }

    // Set confirmation timing when marking as PENDING_CONFIRMATION.
    if (status === "PENDING_CONFIRMATION") {
      updateData.resolutionDate = new Date();
      updateData.pendingConfirmationAt = new Date();
      // Reset handledBySuperAdmin flag when faculty provides new resolution
      updateData.handledBySuperAdmin = false;
    } else {
      // If complaint moves back to IN_PROGRESS, clear stale pending timestamp.
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
      // Backward compatibility: if DB migration for timestamp columns is pending,
      // retry without the new timestamp field so status updates still work.
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
    //
    // After the update rather than inside it: confirmAttachments performs a
    // network round trip per file to check each object's real size, and a
    // transaction held open across that is a transaction held open across a
    // third party's latency. The cost of this ordering is that a failure here
    // leaves the status changed and the photos unbound - which the nightly
    // sweep collects, and which is strictly better than a complaint that
    // cannot be resolved because storage was slow.
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

    res.json({ message: "Complaint status updated successfully" });
  } catch (error) {
    console.error("Update complaint status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============ DOUBT MANAGEMENT ============

// 11. Verify an answer (Faculty only)
export const verifyAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;

    // Get current verification status
    const currentAnswer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: { isVerified: true },
    });

    if (!currentAnswer) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    // Toggle verification status
    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: { isVerified: !currentAnswer.isVerified },
      include: {
        answeredBy: {
          select: {
            id: true,
            name: true,
            userID: true,
          },
        },
      },
    });

    const message = answer.isVerified
      ? "Answer verified successfully"
      : "Answer unverified successfully";

    res.json({ message, answer });
  } catch (error) {
    console.error("Error toggling answer verification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 12. Post an answer to a doubt (Faculty)
export const postAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    // Check if doubt exists
    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
      include: { postedBy: true }, // Include who posted the doubt for notifications
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    // Get the current user's info for notifications
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true },
    });

    // Create answer and update doubt
    const [answer] = await prisma.$transaction([
      prisma.answer.create({
        data: {
          content,
          doubtId,
          answeredById: req.user!.id,
          approvalStatus: ApprovalStatus.APPROVED,
        },
        include: {
          answeredBy: {
            select: {
              id: true,
              name: true,
              userID: true,
              role: true,
              facultyProfile: {
                select: {
                  department: true,
                  subjects: true,
                },
              },
            },
          },
          moderatedBy: {
            select: {
              id: true,
              name: true,
              userID: true,
              role: true,
            },
          },
        },
      }),
      prisma.doubt.update({
        where: { id: doubtId },
        data: {
          answerCount: { increment: 1 },
          status: DoubtStatus.ANSWERED,
          // Update faculty stats
        },
      }),
      prisma.facultyProfile.update({
        where: { userId: req.user!.id },
        data: {
          doubtsSolved: { increment: 1 },
        },
      }),
    ]);

    // Send notification to doubt owner (if not answering own doubt)
    try {
      if (doubt.postedById !== req.user!.id && currentUser) {
        await notifyDoubtAnswer(
          doubt.postedById,
          doubt.title,
          currentUser.name,
          doubtId,
        );
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json({ message: "Answer posted successfully", answer });
  } catch (error) {
    console.error("Error posting answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 12c. Moderate an answer (Faculty)
export const moderateAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;
    const { approvalStatus, moderationNote } = req.body as {
      approvalStatus?: ApprovalStatus;
      moderationNote?: string;
    };

    if (
      !approvalStatus ||
      (approvalStatus !== ApprovalStatus.APPROVED &&
        approvalStatus !== ApprovalStatus.REJECTED)
    ) {
      res
        .status(400)
        .json({ error: "approvalStatus must be APPROVED or REJECTED" });
      return;
    }

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        moderatedById: true,
        answeredBy: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!answer) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    if (answer.answeredBy.role === Role.FACULTY) {
      res.status(400).json({
        error: "Faculty answers do not support moderation updates",
      });
      return;
    }

    if (answer.moderatedById && answer.moderatedById !== req.user!.id) {
      res.status(403).json({
        error:
          "Only the faculty who previously moderated this answer can update it",
      });
      return;
    }

    const updatedAnswer = await prisma.answer.update({
      where: { id: answerId },
      data: {
        approvalStatus,
        moderatedById: req.user!.id,
        moderatedAt: new Date(),
        moderationNote: moderationNote?.trim() || null,
      },
      include: {
        doubt: {
          select: {
            id: true,
            title: true,
            postedById: true,
          },
        },
        answeredBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            role: true,
            facultyProfile: {
              select: {
                department: true,
                subjects: true,
              },
            },
            studentProfile: {
              select: {
                semester: true,
                branch: true,
              },
            },
          },
        },
        moderatedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            role: true,
            facultyProfile: {
              select: {
                department: true,
                subjects: true,
              },
            },
          },
        },
      },
    });

    // CC-25: small on purpose - passing moderation is a floor, not an
    // achievement. The points that matter come from other students.
    if (approvalStatus === ApprovalStatus.APPROVED) {
      await awardReputation({
        userId: updatedAnswer.answeredBy.id,
        reason: ReputationReason.ANSWER_APPROVED,
        sourceType: "Answer",
        sourceId: updatedAnswer.id,
        actorId: req.user!.id,
      });
    }

    // Send notification to doubt creator only when answer is approved
    try {
      if (
        approvalStatus === ApprovalStatus.APPROVED &&
        updatedAnswer.doubt.postedById !== updatedAnswer.answeredBy.id
      ) {
        await notifyDoubtAnswer(
          updatedAnswer.doubt.postedById,
          updatedAnswer.doubt.title,
          updatedAnswer.answeredBy.name,
          updatedAnswer.doubt.id,
        );
      }
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      message:
        approvalStatus === ApprovalStatus.APPROVED
          ? "Answer approved successfully"
          : "Answer rejected successfully",
      answer: updatedAnswer,
    });
  } catch (error) {
    console.error("Error moderating answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 13. Edit an answer (Faculty)
export const editAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    // Check if answer exists and belongs to the user
    const existingAnswer = await prisma.answer.findUnique({
      where: { id: answerId },
    });

    if (!existingAnswer) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    if (existingAnswer.answeredById !== req.user!.id) {
      res.status(403).json({ error: "You can only edit your own answers" });
      return;
    }

    // Create edit history entry
    const editHistory = Array.isArray(existingAnswer.editHistory)
      ? existingAnswer.editHistory
      : [];

    editHistory.push({
      content: existingAnswer.content,
      editedAt: new Date().toISOString(),
    });

    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: {
        content,
        edited: true,
        editHistory,
      },
    });

    res.json({ message: "Answer updated successfully", answer });
  } catch (error) {
    console.error("Error editing answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 13b. Delete answer
export const deleteAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;

    // Check if answer exists and belongs to the user
    const existingAnswer = await prisma.answer.findUnique({
      where: { id: answerId },
    });

    if (!existingAnswer) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    if (existingAnswer.answeredById !== req.user!.id) {
      res.status(403).json({ error: "You can only delete your own answers" });
      return;
    }

    // Get the doubt to update counts
    const doubt = await prisma.doubt.findUnique({
      where: { id: existingAnswer.doubtId },
    });

    if (!doubt) {
      res.status(404).json({ error: "Associated doubt not found" });
      return;
    }

    // Delete the answer (this will cascade delete answer upvotes due to onDelete: Cascade)
    await prisma.answer.delete({
      where: { id: answerId },
    });

    // Update doubt's answer count and upvote count
    await prisma.doubt.update({
      where: { id: existingAnswer.doubtId },
      data: {
        answerCount: { decrement: 1 },
        upVoteCount: { decrement: existingAnswer.upvotes },
        // If this was the accepted answer, clear it and update status
        ...(doubt.acceptedAnswerId === answerId
          ? {
              acceptedAnswerId: null,
              status: DoubtStatus.OPEN,
            }
          : {}),
      },
    });

    // If the answer was accepted, decrement the answerer's doubtsSolved
    if (existingAnswer.isAccepted) {
      const answererProfile = await prisma.studentProfile.findUnique({
        where: { userId: existingAnswer.answeredById },
      });

      if (answererProfile && answererProfile.doubtsSolved > 0) {
        await prisma.studentProfile.update({
          where: { userId: existingAnswer.answeredById },
          data: { doubtsSolved: { decrement: 1 } },
        });
      }
    }

    res.json({ message: "Answer deleted successfully" });
  } catch (error) {
    console.error("Error deleting answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 14. Get all doubts (Faculty can see all doubts)
export const getDoubts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { status, subject, semester, search, myAnswered, limit } = req.query;

    const where: Prisma.DoubtWhereInput = {};

    const doubtStatuses: DoubtStatus[] = [
      DoubtStatus.OPEN,
      DoubtStatus.ANSWERED,
      DoubtStatus.RESOLVED,
    ];
    if (
      status &&
      doubtStatuses.includes(String(status).trim() as DoubtStatus)
    ) {
      where.status = String(status).trim() as DoubtStatus;
    }

    if (subject && String(subject).trim()) {
      where.subject = String(subject).trim();
    }

    if (semester !== undefined && semester !== null && String(semester).trim() !== "") {
      const sem = parseInt(String(semester), 10);
      if (Number.isFinite(sem)) {
        where.semester = sem;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    if (myAnswered === "true") {
      where.answers = { some: { answeredById: req.user!.id } };
    }

    const findOptions: Prisma.DoubtFindManyArgs = {
      ...(Object.keys(where).length > 0 ? { where } : {}),
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            studentProfile: {
              select: {
                semester: true,
                branch: true,
              },
            },
          },
        },
        _count: {
          select: {
            answers: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    };

    // Support optional limit (take) to return only most recent N doubts
    if (limit) {
      const n = parseInt(limit as string, 10);
      if (!isNaN(n) && n > 0) findOptions.take = n;
    }

    const doubts = await prisma.doubt.findMany(findOptions);

    res.json({ doubts });
  } catch (error) {
    console.error("Error fetching doubts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 15. Get a single doubt by ID with all answers (Faculty)
export const getDoubtById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    // Check if user has already viewed this doubt
    const existingView = await prisma.doubtView.findUnique({
      where: {
        doubtId_userId: {
          doubtId: id,
          userId: userId,
        },
      },
    });

    // If user hasn't viewed this doubt before, increment view count and create view record
    if (!existingView) {
      await prisma.$transaction([
        prisma.doubtView.create({
          data: {
            doubtId: id,
            userId: userId,
          },
        }),
        prisma.doubt.update({
          where: { id },
          data: { views: { increment: 1 } },
        }),
      ]);
    }

    // Fetch the doubt with all related data
    const doubt = await prisma.doubt.findFirst({
      where: {
        id,
      },
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            studentProfile: {
              select: {
                semester: true,
                branch: true,
              },
            },
          },
        },
        answers: {
          include: {
            answeredBy: {
              select: {
                id: true,
                name: true,
                userID: true,
                role: true,
                facultyProfile: {
                  select: {
                    department: true,
                    subjects: true,
                  },
                },
                studentProfile: {
                  select: {
                    semester: true,
                    branch: true,
                  },
                },
              },
            },
            moderatedBy: {
              select: {
                id: true,
                name: true,
                userID: true,
                role: true,
              },
            },
          },
          orderBy: [
            { isAccepted: "desc" },
            { isVerified: "desc" },
            { upvotes: "desc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    let doubtUpvote: { id: string } | null = null;
    try {
      doubtUpvote = await prisma.doubtUpvote.findUnique({
        where: {
          doubtId_userId: {
            doubtId: id,
            userId,
          },
        },
        select: { id: true },
      });
    } catch (upvoteReadError) {
      // Backward compatibility: allow doubt details even if upvote table migration isn't applied yet.
      if (!isDoubtUpvoteSchemaMissingError(upvoteReadError)) {
        throw upvoteReadError;
      }
    }

    res.json({
      doubt: {
        ...doubt,
        isUpvotedByUser: Boolean(doubtUpvote),
      },
    });
  } catch (error) {
    console.error("Error fetching doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 15b. Upvote a doubt (toggle)
export const upvoteDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;
    const userId = req.user?.id as string;

    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    const existingUpvote = await prisma.doubtUpvote.findUnique({
      where: {
        doubtId_userId: {
          doubtId,
          userId,
        },
      },
    });

    let message: string;
    let updatedDoubt;

    if (existingUpvote) {
      [, updatedDoubt] = await prisma.$transaction([
        prisma.doubtUpvote.delete({
          where: {
            id: existingUpvote.id,
          },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: { upVoteCount: { decrement: 1 } },
        }),
      ]);
      message = "Doubt upvote removed successfully";
    } else {
      [, updatedDoubt] = await prisma.$transaction([
        prisma.doubtUpvote.create({
          data: {
            doubtId,
            userId,
          },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: { upVoteCount: { increment: 1 } },
        }),
      ]);
      message = "Doubt upvoted successfully";
    }

    res.json({
      message,
      doubt: updatedDoubt,
      isUpvoted: !existingUpvote,
      upVoteCount: updatedDoubt.upVoteCount,
    });
  } catch (error) {
    if (isDoubtUpvoteSchemaMissingError(error)) {
      res.status(503).json({
        error:
          "Doubt upvote feature is temporarily unavailable until database migration is applied",
      });
      return;
    }
    console.error("Error toggling doubt upvote:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 16. Get faculty's answers
export const getMyAnswers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answers = await prisma.answer.findMany({
      where: { answeredById: req.user!.id },
      include: {
        doubt: {
          select: {
            id: true,
            title: true,
            subject: true,
            status: true,
            postedBy: {
              select: {
                name: true,
                userID: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ answers });
  } catch (error) {
    console.error("Error fetching my answers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


/* ------------------------------------------------------------------ *
 * CC-12: AI answer drafts
 *
 * Faculty-only throughout. No student-facing handler reads AnswerDraft, so a
 * draft is structurally incapable of reaching a student before approval.
 * ------------------------------------------------------------------ */

/** The pending draft for a doubt, if one exists. */
export const getAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    if (!doubtId) {
      res.status(400).json({ error: "Doubt id is required" });
      return;
    }

    const draft = await prisma.answerDraft.findUnique({
      where: { doubtId },
      select: {
        id: true,
        content: true,
        model: true,
        sourceIds: true,
        status: true,
        createdAt: true,
      },
    });

    if (!draft || draft.status !== "PENDING") {
      res.json({ draft: null });
      return;
    }

    // Hydrate the grounding so a reviewer can audit what the draft drew on
    // rather than taking it on trust.
    const sources = await prisma.answer.findMany({
      where: { id: { in: draft.sourceIds } },
      select: {
        id: true,
        content: true,
        doubt: { select: { id: true, title: true } },
      },
    });

    res.json({
      draft: {
        id: draft.id,
        content: draft.content,
        model: draft.model,
        createdAt: draft.createdAt.toISOString(),
        sources: sources.map((source) => ({
          answerId: source.id,
          doubtId: source.doubt.id,
          doubtTitle: source.doubt.title,
          excerpt: source.content.slice(0, 300),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Approve a draft, optionally edited.
 *
 * Creates a real Answer **authored by the reviewing faculty member** — they put
 * their name to it and take responsibility. `aiAssisted` is recorded
 * permanently, and `editedOnApproval` makes rubber-stamping measurable.
 */
export const approveAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    const { content } = req.body as { content?: string };

    if (!doubtId || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "Answer content is required" });
      return;
    }

    const draft = await prisma.answerDraft.findUnique({ where: { doubtId } });

    if (!draft || draft.status !== "PENDING") {
      res.status(404).json({ error: "No pending draft for this doubt" });
      return;
    }

    const finalContent = content.trim();
    const edited = finalContent !== draft.content.trim();

    const [answer] = await prisma.$transaction([
      prisma.answer.create({
        data: {
          doubtId,
          content: finalContent,
          answeredById: req.user!.id,
          approvalStatus: ApprovalStatus.APPROVED,
          aiAssisted: true,
        },
        select: { id: true, content: true, createdAt: true },
      }),
      prisma.answerDraft.update({
        where: { doubtId },
        data: {
          status: "APPROVED",
          reviewedById: req.user!.id,
          reviewedAt: new Date(),
          editedOnApproval: edited,
        },
      }),
      prisma.doubt.update({
        where: { id: doubtId },
        data: { answerCount: { increment: 1 }, status: DoubtStatus.ANSWERED },
      }),
    ]);

    res.status(201).json({
      message: "Draft approved and published",
      answer,
      editedOnApproval: edited,
    });
  } catch (error) {
    console.error("Error approving answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Reject a draft. No Answer is created. */
export const rejectAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    const { note } = req.body as { note?: string };

    if (!doubtId) {
      res.status(400).json({ error: "Doubt id is required" });
      return;
    }

    const draft = await prisma.answerDraft.findUnique({ where: { doubtId } });
    if (!draft || draft.status !== "PENDING") {
      res.status(404).json({ error: "No pending draft for this doubt" });
      return;
    }

    await prisma.answerDraft.update({
      where: { doubtId },
      data: {
        status: "REJECTED",
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        reviewNote: typeof note === "string" ? note.slice(0, 500) : null,
      },
    });

    res.json({ message: "Draft rejected" });
  } catch (error) {
    console.error("Error rejecting answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Generate a draft on demand for a specific doubt. Faculty only. */
export const requestAnswerDraft = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.id as string;
    if (!doubtId) {
      res.status(400).json({ error: "Doubt id is required" });
      return;
    }

    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
      select: { id: true, title: true, description: true, subject: true },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    const result = await generateDraftForDoubt(doubt);
    res.json(result);
  } catch (error) {
    console.error("Error generating answer draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * CC-27: the staff directory.
 *
 * Readable by any authenticated member of the institution, because the point
 * is that a student with a flooded bathroom can find the plumber. Only
 * profiles that opted in appear at all — see listDirectory for why absence
 * beats redaction.
 */
export const getStaffDirectory = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { category, teaching, q } = req.query;

    const entries = await listDirectory({
      category: typeof category === "string" ? category.toUpperCase() : null,
      teaching:
        teaching === "true" ? true : teaching === "false" ? false : null,
      query: typeof q === "string" && q.trim() ? q.trim().slice(0, 80) : null,
    });

    res.json({ staff: entries });
  } catch (error) {
    console.error("[CC-27] staff directory failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
