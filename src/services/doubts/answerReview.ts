/**
 * Judging answers (CC-72 stage 2): faculty moderation, and the asker's
 * "this solved it".
 *
 * Both used to live inline in controllers. Moving them here exposed that
 * neither undid what it had done:
 *
 *  - rejecting an answer a moderator had approved left the author holding
 *    the ANSWER_APPROVED points;
 *  - un-accepting an answer, or accepting a different one, left the
 *    previous author holding the ANSWER_ACCEPTED points.
 *
 * Both now revoke. Reputation is a ledger (CC-25): it should only ever say
 * what is currently true.
 */

import { ApprovalStatus, DoubtStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { notifyDoubtAnswer } from "../../utils/notifications.js";
import {
  ReputationReason,
  awardReputation,
  revokeReputation,
} from "../reputation/reputation.js";

export class AnswerReviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AnswerReviewError";
  }
}

const personSelect = {
  id: true,
  name: true,
  userID: true,
  role: true,
  facultyProfile: { select: { department: true, subjects: true } },
} as const;

/** What the moderation endpoint has always returned for the answer. */
const moderatedAnswerInclude = {
  doubt: { select: { id: true, title: true, postedById: true } },
  answeredBy: {
    select: { ...personSelect, studentProfile: { select: { semester: true, branch: true } } },
  },
  moderatedBy: { select: personSelect },
} satisfies Prisma.AnswerInclude;

/**
 * A faculty member approves or rejects a student's answer.
 *
 * Faculty answers are not moderated. Once someone has moderated an answer,
 * only they may change the decision - a second moderator overruling the
 * first would be invisible to both.
 */
export const moderateAnswer = async (input: {
  answerId: string;
  decision: unknown;
  note?: unknown;
  moderatorId: string;
}) => {
  const { answerId, moderatorId } = input;
  const decision = input.decision;
  if (decision !== ApprovalStatus.APPROVED && decision !== ApprovalStatus.REJECTED) {
    throw new AnswerReviewError("approvalStatus must be APPROVED or REJECTED", 400);
  }

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: { approvalStatus: true, moderatedById: true, answeredBy: { select: { role: true } } },
  });
  if (!answer) throw new AnswerReviewError("Answer not found", 404);
  if (answer.answeredBy.role === Role.FACULTY) {
    throw new AnswerReviewError("Faculty answers do not support moderation updates", 400);
  }
  if (answer.moderatedById && answer.moderatedById !== moderatorId) {
    throw new AnswerReviewError(
      "Only the faculty who previously moderated this answer can update it",
      403,
    );
  }

  const updated = await prisma.answer.update({
    where: { id: answerId },
    data: {
      approvalStatus: decision,
      moderatedById: moderatorId,
      moderatedAt: new Date(),
      moderationNote: typeof input.note === "string" ? input.note.trim() || null : null,
    },
    include: moderatedAnswerInclude,
  });

  const reputation = {
    userId: updated.answeredBy.id,
    reason: ReputationReason.ANSWER_APPROVED,
    sourceType: "Answer" as const,
    sourceId: updated.id,
    actorId: moderatorId,
  };

  if (decision === ApprovalStatus.APPROVED) {
    // CC-25: small on purpose - passing moderation is a floor, not an
    // achievement. A repeat approval scores nothing (unique per source).
    await awardReputation(reputation);

    if (updated.doubt.postedById !== updated.answeredBy.id) {
      try {
        await notifyDoubtAnswer(
          updated.doubt.postedById,
          updated.doubt.title,
          updated.answeredBy.name,
          updated.doubt.id,
        );
      } catch (error) {
        console.error("[answers] notification failed:", error);
      }
    }
  } else if (answer.approvalStatus === ApprovalStatus.APPROVED) {
    // Changed in CC-72: a reversed approval takes its points back.
    await revokeReputation(reputation);
  }

  return updated;
};

/** Decrement a student's solved count, never below zero. */
const unsolve = (tx: Prisma.TransactionClient, userId: string) =>
  tx.studentProfile.updateMany({
    where: { userId, doubtsSolved: { gt: 0 } },
    data: { doubtsSolved: { decrement: 1 } },
  });

/**
 * The asker accepts an answer, or un-accepts the one they accepted.
 *
 * Accepting a second answer moves the acceptance: the first author loses
 * the solved count and the points, the second gains them. All of the
 * flag changes happen in one transaction, so a failure part-way can no
 * longer leave two answers marked accepted.
 */
export const toggleAcceptedAnswer = async (input: {
  doubtId: string;
  answerId: string;
  askerId: string;
}) => {
  const { doubtId, answerId, askerId } = input;

  const doubt = await prisma.doubt.findUnique({
    where: { id: doubtId },
    select: { postedById: true, acceptedAnswerId: true, answerCount: true },
  });
  if (!doubt) throw new AnswerReviewError("Doubt not found", 404);
  if (doubt.postedById !== askerId) {
    throw new AnswerReviewError("Only the doubt owner can accept answers", 403);
  }

  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    select: { doubtId: true, isAccepted: true, answeredById: true },
  });
  if (!answer || answer.doubtId !== doubtId) {
    throw new AnswerReviewError("Answer not found", 404);
  }

  const acceptedPoints = (userId: string, sourceId: string) => ({
    userId,
    reason: ReputationReason.ANSWER_ACCEPTED,
    sourceType: "Answer" as const,
    sourceId,
    actorId: askerId,
  });

  if (answer.isAccepted) {
    const [updatedAnswer, updatedDoubt] = await prisma.$transaction(async (tx) => {
      const a = await tx.answer.update({ where: { id: answerId }, data: { isAccepted: false } });
      const d = await tx.doubt.update({
        where: { id: doubtId },
        data: {
          acceptedAnswerId: null,
          status: doubt.answerCount > 0 ? DoubtStatus.ANSWERED : DoubtStatus.OPEN,
        },
      });
      await unsolve(tx, answer.answeredById);
      return [a, d] as const;
    });

    // Changed in CC-72: un-accepting takes the acceptance points back.
    await revokeReputation(acceptedPoints(answer.answeredById, answerId));

    return { message: "Answer unaccepted successfully", answer: updatedAnswer, doubt: updatedDoubt };
  }

  const previous =
    doubt.acceptedAnswerId && doubt.acceptedAnswerId !== answerId
      ? await prisma.answer.findUnique({
          where: { id: doubt.acceptedAnswerId },
          select: { id: true, answeredById: true },
        })
      : null;

  const [updatedAnswer, updatedDoubt] = await prisma.$transaction(async (tx) => {
    if (previous) {
      await tx.answer.update({ where: { id: previous.id }, data: { isAccepted: false } });
      await unsolve(tx, previous.answeredById);
    }
    const a = await tx.answer.update({ where: { id: answerId }, data: { isAccepted: true } });
    const d = await tx.doubt.update({
      where: { id: doubtId },
      data: { acceptedAnswerId: answerId, status: DoubtStatus.RESOLVED },
    });
    // Only students keep a solved count; updateMany is a no-op for faculty.
    await tx.studentProfile.updateMany({
      where: { userId: answer.answeredById },
      data: { doubtsSolved: { increment: 1 } },
    });
    return [a, d] as const;
  });

  if (previous) {
    // Changed in CC-72: the acceptance moved, and so do its points.
    await revokeReputation(acceptedPoints(previous.answeredById, previous.id));
  }
  // CC-25: the strongest signal there is - the asker says this solved it.
  await awardReputation(acceptedPoints(answer.answeredById, answerId));

  return { message: "Answer marked as accepted", answer: updatedAnswer, doubt: updatedDoubt };
};
