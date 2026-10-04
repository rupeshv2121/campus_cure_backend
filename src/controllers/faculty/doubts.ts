/**
 * The doubt community from the faculty side: browsing, answering, moderating and verifying answers.
 *
 * Split out of facultyController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  AttachmentEntity,
  DoubtStatus,
  Prisma,
  Role
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  extractInlineImageIds,
  prepareEdit,
} from "../../services/content/sanitize.js";
import {
  ReputationReason,
  awardReputation,
} from "../../services/reputation/reputation.js";
import {
  AttachmentError,
  bindPostAttachments,
} from "../../services/storage/attachments.js";
import type { AuthRequest } from "../../types/index.js";
import {
  notifyDoubtAnswer
} from "../../utils/notifications.js";
import { isDoubtUpvoteSchemaMissingError } from "./shared.js";

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

    // CC-23: sanitised in the format the answer was stored as. Writing the
    // body raw here let an HTML answer be edited into stored XSS.
    const preparedContent = prepareEdit(content, existingAnswer.contentFormat);

    // Bound before the write, so an unbindable image fails the edit cleanly.
    await bindPostAttachments({
      entityType: AttachmentEntity.ANSWER,
      entityId: answerId,
      userId: req.user!.id,
      inlineImageIds: extractInlineImageIds(preparedContent),
    });

    const answer = await prisma.answer.update({
      where: { id: answerId },
      data: {
        content: preparedContent,
        edited: true,
        editHistory,
      },
    });

    res.json({ message: "Answer updated successfully", answer });
  } catch (error) {
    if (error instanceof AttachmentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

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
