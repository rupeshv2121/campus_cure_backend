import type { Request, Response } from "express";
import { prisma } from "../config/database.js";
import { ApprovalStatus, Role, DoubtStatus } from "../generated/prisma/index.js";
import type { AuthRequest } from "../types/index.js";

// 5. Create Student Profile (Called after basic registration)
export const createStudentProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      userId,
      enrollmentNumber,
      department,
      branch,
      semester,
      phoneNumber,
      address,
      guardianName,
      guardianPhone,
    } = req.body;

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

    if (user.role !== Role.STUDENT) {
      res.status(400).json({ error: "User is not a student" });
      return;
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Student profile already exists" });
      return;
    }

    const profile = await prisma.studentProfile.create({
      data: {
        userId,
        enrollmentNumber: enrollmentNumber || user.username,
        department: department || "",
        branch: branch || "",
        semester: semester || 1,
        phoneNumber: phoneNumber || 0,
        address: address || "",
        isStudying:
          req.body.isStudying !== undefined ? req.body.isStudying : true,
        guardianName: guardianName || "",
        guardianPhone: guardianPhone || "",
        doubtsAsked: 0,
        doubtsSolved: 0,
      },
    });

    // Approve the user after profile creation
    await prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
    });

    res.status(201).json({
      message: "Student profile created successfully. You can now login.",
      profile,
    });
  } catch (error) {
    console.error("Create student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 6. Get Student Profile
export const getStudentProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const profile = await prisma.studentProfile.findUnique({
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
      res.status(404).json({ error: "Student profile not found" });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error("Get student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 7. Update Student Profile
export const updateStudentProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      department,
      branch,
      semester,
      phoneNumber,
      address,
      guardianName,
      guardianPhone,
    } = req.body;

    const profile = await prisma.studentProfile.update({
      where: { userId: req.user!.id },
      data: {
        ...(department && { department }),
        ...(branch && { branch }),
        ...(semester && { semester }),
        ...(phoneNumber && { phoneNumber }),
        ...(address && { address }),
        ...(guardianName && { guardianName }),
        ...(guardianPhone && { guardianPhone }),
      },
    });

    res.json({ message: "Profile updated successfully", profile });
  } catch (error) {
    console.error("Update student profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 8. Raise Complaint
export const raiseComplaint = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { title, description, category, priority, classroomNumber, block } =
      req.body;

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

    console.log("Raising complaint with data:", {
      title,
      description,
      category,
      priority,
      classroomNumber,
      block,
    });

    // Create complaint and update student profile counters in a transaction
    const [complaint] = await prisma.$transaction([
      prisma.complaint.create({
        data: {
          title,
          description,
          category,
          priority,
          classroomNumber,
          block,
          raisedBy: { connect: { id: req.user!.id } },
        },
      }),
      prisma.studentProfile.update({
        where: { userId: req.user!.id },
        data: {
          totalComplaints: { increment: 1 },
          totalActiveComplaints: { increment: 1 },
        },
      }),
    ]);

    res
      .status(201)
      .json({ message: "Complaint raised successfully", complaint });
  } catch (error) {
    console.error("Error raising complaint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 9. Get All Complaints for student
export const getComplaints = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { raisedById: req.user!.id },
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

    res.json({ complaints });
  } catch (e) {
    console.error("Error fetching complaints:", e);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ============ DOUBT MANAGEMENT ============

// 10. Post a new doubt
export const postDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { title, description, semester, subject, labels } = req.body;

    if (!title || !description || !semester || !subject) {
      res.status(400).json({ error: "Title, description, semester, and subject are required" });
      return;
    }

    console.log("Posting doubt with data:");

    // Create doubt and update student profile in a transaction
    const [doubt] = await prisma.$transaction([
      prisma.doubt.create({
        data: {
          title,
          description,
          semester,
          subject,
          labels: labels || [],
          postedBy: { connect: { id: req.user!.id } },
        },
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
        },
      }),
      prisma.studentProfile.update({
        where: { userId: req.user!.id },
        data: {
          doubtsAsked: { increment: 1 },
        },
      }),
    ]);

    res.status(201).json({ message: "Doubt posted successfully", doubt });
  } catch (error) {
    console.error("Error posting doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 11. Get all doubts with filters
export const getDoubts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { status, subject, semester, search } = req.query;

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

// 12. Get a single doubt by ID with all answers
export const getDoubtById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Increment view count
    const doubt = await prisma.doubt.update({
      where: { id },
      data: { views: { increment: 1 } },
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

// 13. Edit a doubt
export const editDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, description, subject, labels } = req.body;

    // Check if doubt exists and belongs to the user
    const existingDoubt = await prisma.doubt.findUnique({
      where: { id },
    });

    if (!existingDoubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    if (existingDoubt.postedById !== req.user!.id) {
      res.status(403).json({ error: "You can only edit your own doubts" });
      return;
    }

    // Create edit history entry
    const editHistory = Array.isArray(existingDoubt.editHistory)
      ? existingDoubt.editHistory
      : [];

    editHistory.push({
      title: existingDoubt.title,
      description: existingDoubt.description,
      editedAt: new Date().toISOString(),
    });

    const doubt = await prisma.doubt.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(subject && { subject }),
        ...(labels && { labels }),
        edited: true,
        editHistory,
      },
    });

    res.json({ message: "Doubt updated successfully", doubt });
  } catch (error) {
    console.error("Error editing doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 14. Delete a doubt
export const deleteDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Check if doubt exists and belongs to the user
    const existingDoubt = await prisma.doubt.findUnique({
      where: { id },
    });

    if (!existingDoubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    if (existingDoubt.postedById !== req.user!.id) {
      res.status(403).json({ error: "You can only delete your own doubts" });
      return;
    }

    // Delete doubt (will cascade delete answers)
    await prisma.$transaction([
      prisma.answer.deleteMany({
        where: { doubtId: id },
      }),
      prisma.doubt.delete({
        where: { id },
      }),
      prisma.studentProfile.update({
        where: { userId: req.user!.id },
        data: {
          doubtsAsked: { decrement: 1 },
        },
      }),
    ]);

    res.json({ message: "Doubt deleted successfully" });
  } catch (error) {
    console.error("Error deleting doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 15. Mark an answer as accepted (only by doubt owner)
export const markAnswerAsAccepted = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;
    const answerId = req.params.answerId as string;

    // Check if doubt exists and belongs to the user
    const doubt = await prisma.doubt.findUnique({
      where: { id: doubtId },
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

    if (doubt.postedById !== req.user!.id) {
      res.status(403).json({ error: "Only the doubt owner can accept answers" });
      return;
    }

    // Check if answer exists and belongs to the doubt
    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
    });

    if (!answer || answer.doubtId !== doubtId) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    // If there was a previously accepted answer, unmark it
    if (doubt.acceptedAnswerId) {
      await prisma.answer.update({
        where: { id: doubt.acceptedAnswerId },
        data: { isAccepted: false },
      });
    }

    // Mark the new answer as accepted and update doubt status
    const [updatedAnswer, updatedDoubt] = await prisma.$transaction([
      prisma.answer.update({
        where: { id: answerId },
        data: { isAccepted: true },
      }),
      prisma.doubt.update({
        where: { id: doubtId },
        data: {
          acceptedAnswerId: answerId,
          status: DoubtStatus.RESOLVED,
        },
      }),
    ]);

    // Update student profile - increment doubtsSolved for the answerer
    const answererProfile = await prisma.studentProfile.findUnique({
      where: { userId: answer.answeredById },
    });

    if (answererProfile) {
      await prisma.studentProfile.update({
        where: { userId: answer.answeredById },
        data: { doubtsSolved: { increment: 1 } },
      });
    }

    res.json({
      message: "Answer marked as accepted",
      answer: updatedAnswer,
      doubt: updatedDoubt,
    });
  } catch (error) {
    console.error("Error marking answer as accepted:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 16. Upvote an answer
export const upvoteAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;

    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: { upvotes: { increment: 1 } },
    });

    // Also update the doubt's upvote count
    await prisma.doubt.update({
      where: { id: answer.doubtId },
      data: { upVoteCount: { increment: 1 } },
    });

    res.json({ message: "Answer upvoted successfully", answer });
  } catch (error) {
    console.error("Error upvoting answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 17. Post an answer to a doubt (students can also answer)
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
    });

    if (!doubt) {
      res.status(404).json({ error: "Doubt not found" });
      return;
    }

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
              studentProfile: {
                select: {
                  semester: true,
                  branch: true,
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
        },
      }),
    ]);

    res.status(201).json({ message: "Answer posted successfully", answer });
  } catch (error) {
    console.error("Error posting answer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 18. Edit an answer
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

// 19. Get student's own doubts
export const getMyDoubts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubts = await prisma.doubt.findMany({
      where: { postedById: req.user!.id },
      include: {
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
    console.error("Error fetching my doubts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 20. Get student's own answers across all doubts
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
            semester: true,
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

// 21. Get student's own answer for a specific doubt
export const getMyAnswerForDoubt = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const doubtId = req.params.doubtId as string;

    const answer = await prisma.answer.findFirst({
      where: {
        doubtId,
        answeredById: req.user!.id,
      },
      include: {
        answeredBy: {
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
      },
    });

    if (!answer) {
      res.status(404).json({ error: "You haven't answered this doubt yet" });
      return;
    }

    res.json({ answer });
  } catch (error) {
    console.error("Error fetching my answer for doubt:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
