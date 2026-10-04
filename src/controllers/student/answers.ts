/**
 * Answers to doubts: posting, editing, upvoting and accepting.
 *
 * Split out of studentController.ts by CC-72. Stage 2 moved the business rules for the
 * thin handlers here into services/ (complaints/ or doubts/); they now only
 * translate HTTP in and errors out.
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
  AnswerReviewError,
  toggleAcceptedAnswer,
} from "../../services/doubts/answerReview.js";
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
    // CC-72: the rules live in services/doubts/answerReview.ts.
    res.json(
      await toggleAcceptedAnswer({
        doubtId: req.params.doubtId as string,
        answerId: req.params.answerId as string,
        askerId: req.user!.id,
      }),
    );
  } catch (error) {
    if (error instanceof AnswerReviewError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
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

    const exists = await prisma.answer.findUnique({
      where: { id: answerId },
      select: { id: true },
    });
    if (!exists) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }

    const existingUpvote = await prisma.answerUpvote.findUnique({
      where: { answerId_userId: { answerId, userId } },
      select: { id: true },
    });

    let answer;
    try {
      // The vote row and the answer's count change together or not at all.
      // The doubt's upVoteCount is NOT touched: it counts votes on the doubt
      // itself, and adding answer votes to it inflated the number on the
      // "Upvote this doubt" button.
      answer = await prisma.$transaction(async (tx) => {
        if (existingUpvote) {
          await tx.answerUpvote.delete({ where: { id: existingUpvote.id } });
        } else {
          await tx.answerUpvote.create({ data: { answerId, userId } });
        }
        return tx.answer.update({
          where: { id: answerId },
          data: { upvotes: existingUpvote ? { decrement: 1 } : { increment: 1 } },
        });
      });
    } catch (error) {
      // A double tap: the other request already made this change. Answer
      // with the state it left rather than a 500.
      const code = (error as { code?: string }).code;
      if (code === "P2002" || code === "P2025") {
        const current = await prisma.answer.findUnique({ where: { id: answerId } });
        res.json({
          message: "Answer upvote already updated",
          answer: current,
          isUpvoted: code === "P2002",
        });
        return;
      }
      throw error;
    }

    // CC-25: the points follow the vote. Self-votes and repeats score nothing
    // (see the service).
    const points = {
      userId: answer.answeredById,
      reason: ReputationReason.ANSWER_UPVOTED,
      sourceType: "Answer" as const,
      sourceId: answerId,
      actorId: userId,
    };
    if (existingUpvote) await revokeReputation(points);
    else await awardReputation(points);

    res.json({
      message: existingUpvote
        ? "Answer upvote removed successfully"
        : "Answer upvoted successfully",
      answer,
      isUpvoted: !existingUpvote,
    });
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

    // Update doubt's answer count. Not its upVoteCount: that counts votes on
    // the doubt itself, and an answer's votes never belonged to it.
    await prisma.doubt.update({
      where: { id: existingAnswer.doubtId },
      data: {
        answerCount: { decrement: 1 },
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
