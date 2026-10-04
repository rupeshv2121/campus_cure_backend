/**
 * Answers to doubts: posting, editing, upvoting and accepting.
 *
 * Split out of studentController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  ApprovalStatus,
  AttachmentEntity,
  DoubtStatus
} from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../config/database.js";
import {
  extractInlineImageIds,
  prepareContent,
  prepareEdit,
} from "../../services/content/sanitize.js";
import {
  ReputationReason,
  awardReputation,
  revokeReputation,
} from "../../services/reputation/reputation.js";
import {
  AttachmentError,
  bindPostAttachments
} from "../../services/storage/attachments.js";
import type { AuthRequest } from "../../types/index.js";

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
      res
        .status(403)
        .json({ error: "Only the doubt owner can accept answers" });
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

    // Check if this answer is already accepted
    const isCurrentlyAccepted = answer.isAccepted;

    let updatedAnswer;
    let updatedDoubt;
    let message;

    if (isCurrentlyAccepted) {
      // Unaccept the answer
      [updatedAnswer, updatedDoubt] = await prisma.$transaction([
        prisma.answer.update({
          where: { id: answerId },
          data: { isAccepted: false },
        }),
        prisma.doubt.update({
          where: { id: doubtId },
          data: {
            acceptedAnswerId: null,
            status:
              doubt.answerCount > 0 ? DoubtStatus.ANSWERED : DoubtStatus.OPEN,
          },
        }),
      ]);

      // Decrement doubtsSolved for the answerer
      const answererProfile = await prisma.studentProfile.findUnique({
        where: { userId: answer.answeredById },
      });

      if (answererProfile && answererProfile.doubtsSolved > 0) {
        await prisma.studentProfile.update({
          where: { userId: answer.answeredById },
          data: { doubtsSolved: { decrement: 1 } },
        });
      }

      message = "Answer unaccepted successfully";
    } else {
      // If there was a previously accepted answer, unmark it
      if (doubt.acceptedAnswerId) {
        await prisma.answer.update({
          where: { id: doubt.acceptedAnswerId },
          data: { isAccepted: false },
        });

        // Decrement doubtsSolved for the previous answerer
        const previousAnswer = await prisma.answer.findUnique({
          where: { id: doubt.acceptedAnswerId },
        });
        if (previousAnswer) {
          const previousAnswererProfile =
            await prisma.studentProfile.findUnique({
              where: { userId: previousAnswer.answeredById },
            });
          if (
            previousAnswererProfile &&
            previousAnswererProfile.doubtsSolved > 0
          ) {
            await prisma.studentProfile.update({
              where: { userId: previousAnswer.answeredById },
              data: { doubtsSolved: { decrement: 1 } },
            });
          }
        }
      }

      // Mark the new answer as accepted and update doubt status
      [updatedAnswer, updatedDoubt] = await prisma.$transaction([
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

      // CC-25: the strongest signal available - the person who asked says
      // this is what solved it.
      await awardReputation({
        userId: answer.answeredById,
        reason: ReputationReason.ANSWER_ACCEPTED,
        sourceType: "Answer",
        sourceId: answerId,
        actorId: req.user!.id,
      });

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

      message = "Answer marked as accepted";
    }

    res.json({
      message,
      answer: updatedAnswer,
      doubt: updatedDoubt,
    });
  } catch (error) {
    console.error("Error toggling answer acceptance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 16. Upvote an answer (toggle)
export const upvoteAnswer = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answerId = req.params.answerId as string;
    const userId = req.user?.id as string;

    // Check if user has already upvoted this answer
    const existingUpvote = await prisma.answerUpvote.findUnique({
      where: {
        answerId_userId: {
          answerId,
          userId,
        },
      },
    });

    let answer;
    let message;

    if (existingUpvote) {
      // User has already upvoted, so remove the upvote (decrement)
      await prisma.answerUpvote.delete({
        where: {
          id: existingUpvote.id,
        },
      });

      answer = await prisma.answer.update({
        where: { id: answerId },
        data: { upvotes: { decrement: 1 } },
      });

      // Also update the doubt's upvote count
      await prisma.doubt.update({
        where: { id: answer.doubtId },
        data: { upVoteCount: { decrement: 1 } },
      });

      // CC-25: the upvote is gone, so the points go with it.
      await revokeReputation({
        userId: answer.answeredById,
        reason: ReputationReason.ANSWER_UPVOTED,
        sourceType: "Answer",
        sourceId: answerId,
        actorId: userId,
      });

      message = "Answer upvote removed successfully";
    } else {
      // User hasn't upvoted yet, so add the upvote (increment)
      await prisma.answerUpvote.create({
        data: {
          answerId,
          userId,
        },
      });

      answer = await prisma.answer.update({
        where: { id: answerId },
        data: { upvotes: { increment: 1 } },
      });

      // Also update the doubt's upvote count
      await prisma.doubt.update({
        where: { id: answer.doubtId },
        data: { upVoteCount: { increment: 1 } },
      });

      // CC-25: self-upvotes and repeats score nothing - see the service.
      await awardReputation({
        userId: answer.answeredById,
        reason: ReputationReason.ANSWER_UPVOTED,
        sourceType: "Answer",
        sourceId: answerId,
        actorId: userId,
      });

      message = "Answer upvoted successfully";
    }

    res.json({ message, answer, isUpvoted: !existingUpvote });
  } catch (error) {
    console.error("Error toggling answer upvote:", error);
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
    const { content, attachmentIds, contentFormat } = req.body;

    const preparedAnswer = prepareContent(content, contentFormat);

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
          content: preparedAnswer.value,
          contentFormat: preparedAnswer.format,
          doubtId,
          answeredById: req.user!.id,
          approvalStatus: ApprovalStatus.PENDING,
        },
        include: {
          answeredBy: {
            select: {
              id: true,
              name: true,
              userID: true,
              role: true,
              reputation: true,
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
              reputation: true,
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

    // CC-24: bind uploaded files now the answer has an id, including inline
    // images (CC-23).
    await bindPostAttachments({
      entityType: AttachmentEntity.ANSWER,
      entityId: answer.id,
      userId: req.user!.id,
      attachmentIds,
      inlineImageIds: extractInlineImageIds(preparedAnswer.value),
    });

    // Note: Notification is sent only when answer is approved by faculty,
    // not when posted (to avoid notifying about pending answers)

    res.status(201).json({ message: "Answer posted successfully", answer });
  } catch (error) {
    // A rejected attachment is the student's to fix - wrong file, upload
    // never finished, storage not configured - not a server fault.
    if (error instanceof AttachmentError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

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

    if (existingAnswer.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({
        error:
          "You can only edit your answer before faculty approves or rejects it",
      });
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

// 18b. Delete answer
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

    if (existingAnswer.approvalStatus !== ApprovalStatus.PENDING) {
      res.status(400).json({
        error:
          "You can only delete your answer before faculty approves or rejects it",
      });
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

// 20. Get student's own answers across all doubts
export const getMyAnswers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const answers = await prisma.answer.findMany({
      where: { answeredById: req.user!.id },
      include: {
        moderatedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            role: true,
          },
        },
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
        moderatedBy: {
          select: {
            id: true,
            name: true,
            userID: true,
            role: true,
          },
        },
        answeredBy: {
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
