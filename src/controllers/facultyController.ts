import { ApprovalStatus, DoubtStatus, Prisma, Role } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import type { AuthRequest } from "../types/index.js";
import {
  notifyComplaintStatusChange,
  notifyDoubtAnswer,
} from "../utils/notifications.js";

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
            username: true,
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
    const { department, branch, phoneNumber, address, subjects, isTeaching } =
      req.body;

    const data: {
      department?: string;
      branch?: string;
      phoneNumber?: string;
      address?: string;
      subjects?: string[];
      isTeaching?: boolean;
    } = {};

    if (department !== undefined) {
      data.department = String(department).trim();
    }

    if (branch !== undefined) {
      data.branch = String(branch).trim();
    }

    if (phoneNumber !== undefined) {
      data.phoneNumber = String(phoneNumber).trim();
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
    const complaints = await prisma.complaint.findMany({
      where: { assignedToId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ complaints });
  } catch (error) {
    console.error("Get assigned complaints error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update Complaint Status (Faculty only - can update to IN_PROGRESS or PENDING_STUDENT_APPROVAL)
export const updateComplaintStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaintId = req.params.complaintId as string;
    const { status, resolutionNote } = req.body;

    if (!complaintId || !status) {
      res.status(400).json({ error: "Complaint ID and status are required" });
      return;
    }

    // Faculty can only move to IN_PROGRESS, PENDING_CONFIRMATION (old), or PENDING_STUDENT_APPROVAL (new)
    const validFacultyStatuses = [
      "IN_PROGRESS",
      "PENDING_CONFIRMATION",
      "PENDING_STUDENT_APPROVAL",
    ];
    if (!validFacultyStatuses.includes(status)) {
      res.status(400).json({
        error:
          "Faculty can only update status to IN_PROGRESS or PENDING_STUDENT_APPROVAL",
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
      res.status(403).json({ error: "This complaint is not assigned to you" });
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

    // Set resolution date when marking as PENDING_STUDENT_APPROVAL or PENDING_CONFIRMATION
    if (
      status === "PENDING_STUDENT_APPROVAL" ||
      status === "PENDING_CONFIRMATION"
    ) {
      updateData.resolutionDate = new Date();
      // Reset handledBySuperAdmin flag when faculty provides new resolution
      updateData.handledBySuperAdmin = false;
    }

    await prisma.complaint.update({
      where: { id: complaintId },
      data: updateData,
    });

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
            username: true,
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
        },
        include: {
          answeredBy: {
            select: {
              id: true,
              name: true,
              username: true,
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
  } catch (error) {
    console.error("Error posting answer:", error);
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
    const { status, subject, semester, search, myAnswered } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (subject) {
      where.subject = subject;
    }

    if (semester) {
      where.semester = parseInt(semester as string);
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (myAnswered === "true") {
      where.answers = { some: { answeredById: req.user!.id } };
    }

    const doubts = await prisma.doubt.findMany({
      where,
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            username: true,
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
    });

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
    const doubt = await prisma.doubt.findUnique({
      where: { id },
      include: {
        postedBy: {
          select: {
            id: true,
            name: true,
            username: true,
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
                username: true,
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

    res.json({ doubt });
  } catch (error) {
    console.error("Error fetching doubt:", error);
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
                username: true,
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
