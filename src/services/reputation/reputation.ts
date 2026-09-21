/**
 * Reputation (CC-25).
 *
 * An event ledger with a denormalised total. The ledger is the truth: it can
 * explain a score, be recomputed after a bug, and be reversed when the upvote
 * that caused it is withdrawn. A bare counter can do none of those.
 *
 * See docs/specs/CC-25-reputation.md.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
import {
  REPUTATION_DAILY_CAP,
  REPUTATION_ENABLED,
} from "../../config/env.js";

export const ReputationReason = {
  ANSWER_ACCEPTED: "answer.accepted",
  ANSWER_UPVOTED: "answer.upvoted",
  ANSWER_APPROVED: "answer.approved",
  DOUBT_UPVOTED: "doubt.upvoted",
} as const;

export type ReputationReasonValue =
  (typeof ReputationReason)[keyof typeof ReputationReason];

/**
 * Points per reason.
 *
 * Answering is worth roughly five times asking, deliberately. A forum where
 * asking scores well fills with questions and empties of answers.
 */
export const POINTS: Record<ReputationReasonValue, number> = {
  [ReputationReason.ANSWER_ACCEPTED]: 15,
  [ReputationReason.ANSWER_UPVOTED]: 10,
  // Small on purpose: passing moderation is a floor, not an achievement.
  [ReputationReason.ANSWER_APPROVED]: 2,
  [ReputationReason.DOUBT_UPVOTED]: 2,
};

/**
 * Ranks, derived from the total and never stored.
 *
 * A stored rank is a second thing to keep in sync with the first. Thresholds
 * are guesses on a corpus of seven doubts - the right time to set them
 * properly is when there is a distribution to look at.
 */
export const RANKS: Array<{ name: string; from: number }> = [
  { name: "Expert", from: 1000 },
  { name: "Mentor", from: 400 },
  { name: "Helper", from: 150 },
  { name: "Contributor", from: 50 },
  { name: "Newcomer", from: 0 },
];

export const rankFor = (reputation: number): string =>
  RANKS.find((rank) => reputation >= rank.from)?.name ?? "Newcomer";

/** Points to the next rank, or null at the top. */
export const nextRank = (
  reputation: number,
): { name: string; needed: number } | null => {
  const higher = [...RANKS]
    .reverse()
    .find((rank) => rank.from > reputation);

  return higher ? { name: higher.name, needed: higher.from - reputation } : null;
};

export interface AwardInput {
  /** Who earns the points. */
  userId: string;
  reason: ReputationReasonValue;
  sourceType: "Answer" | "Doubt";
  sourceId: string;
  /** Who caused it. Self-awards score nothing. */
  actorId?: string | undefined;
  tx?: Prisma.TransactionClient | undefined;
}

export interface AwardResult {
  awarded: boolean;
  delta?: number;
  reason?: string;
}

/** Points earned by one user since midnight. */
const earnedToday = async (
  db: Prisma.TransactionClient | typeof prisma,
  userId: string,
): Promise<number> => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const sum = await db.reputationEvent.aggregate({
    where: { userId, createdAt: { gte: since }, delta: { gt: 0 } },
    _sum: { delta: true },
  });

  return sum._sum.delta ?? 0;
};

/**
 * Award points.
 *
 * NEVER THROWS. An upvote that fails to score is a missing point; an upvote
 * that 500s is a broken button.
 */
export const awardReputation = async (
  input: AwardInput,
): Promise<AwardResult> => {
  try {
    if (!REPUTATION_ENABLED) return { awarded: false, reason: "disabled" };

    // You cannot pay yourself. Checked before the write rather than relying on
    // the unique constraint, which would happily allow one self-award.
    if (input.actorId && input.actorId === input.userId) {
      return { awarded: false, reason: "self" };
    }

    const db = input.tx ?? prisma;
    const delta = POINTS[input.reason];

    // Caps EARNING, not voting. The upvote still registers and still counts on
    // the answer - it just stops paying. Dropping the vote instead would leave
    // the voter thinking their click did nothing.
    if ((await earnedToday(db, input.userId)) >= REPUTATION_DAILY_CAP) {
      return { awarded: false, reason: "daily-cap" };
    }

    await db.reputationEvent.create({
      data: {
        userId: input.userId,
        delta,
        reason: input.reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        actorId: input.actorId ?? null,
      },
    });

    await db.user.update({
      where: { id: input.userId },
      data: { reputation: { increment: delta } },
      select: { id: true },
    });

    return { awarded: true, delta };
  } catch (error) {
    // A duplicate is the unique constraint doing its job, not a fault.
    if ((error as { code?: string }).code === "P2002") {
      return { awarded: false, reason: "already-awarded" };
    }

    console.error(
      `[CC-25] award failed for ${input.userId}:`,
      (error as Error).message,
    );
    return { awarded: false, reason: "error" };
  }
};

/**
 * Take points back when the thing that earned them is undone.
 *
 * Deletes the ledger row rather than writing a negative one: the event did not
 * happen any more, and keeping a +10 and a -10 would make "why do I have this
 * score" harder to read, not easier.
 */
export const revokeReputation = async (
  input: Omit<AwardInput, "tx"> & { tx?: Prisma.TransactionClient | undefined },
): Promise<AwardResult> => {
  try {
    if (!REPUTATION_ENABLED) return { awarded: false, reason: "disabled" };

    const db = input.tx ?? prisma;

    const existing = await db.reputationEvent.findFirst({
      where: {
        userId: input.userId,
        reason: input.reason,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        actorId: input.actorId ?? null,
      },
    });

    // Nothing to reverse - a self-upvote being withdrawn, or a capped one that
    // never scored in the first place.
    if (!existing) return { awarded: false, reason: "not-found" };

    await db.reputationEvent.delete({ where: { id: existing.id } });

    await db.user.update({
      where: { id: input.userId },
      data: { reputation: { decrement: existing.delta } },
      select: { id: true },
    });

    return { awarded: true, delta: -existing.delta };
  } catch (error) {
    console.error(
      `[CC-25] revoke failed for ${input.userId}:`,
      (error as Error).message,
    );
    return { awarded: false, reason: "error" };
  }
};

export interface ReputationSummary {
  reputation: number;
  rank: string;
  next: { name: string; needed: number } | null;
  earnedToday: number;
  dailyCap: number;
}

export const getReputationSummary = async (
  userId: string,
): Promise<ReputationSummary> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputation: true },
  });

  const reputation = user?.reputation ?? 0;

  return {
    reputation,
    rank: rankFor(reputation),
    next: nextRank(reputation),
    earnedToday: await earnedToday(prisma, userId),
    dailyCap: REPUTATION_DAILY_CAP,
  };
};

/** The caller's own ledger — why they have the score they have. */
export const getReputationHistory = (userId: string, limit = 50) =>
  prisma.reputationEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, limit)),
  });

/**
 * The leaderboard.
 *
 * Erased accounts are excluded: a tombstone on a leaderboard is both useless
 * and a small privacy leak, since position plus timing can re-identify.
 */
export const getLeaderboard = async (limit = 20) => {
  const users = await prisma.user.findMany({
    where: { reputation: { gt: 0 }, erasedAt: null, isActive: true },
    orderBy: { reputation: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    select: {
      id: true,
      name: true,
      userID: true,
      role: true,
      reputation: true,
      studentProfile: { select: { branch: true, semester: true } },
    },
  });

  return users.map((user, index) => ({
    position: index + 1,
    ...user,
    rank: rankFor(user.reputation),
  }));
};

/**
 * Recompute a user's total from their ledger.
 *
 * The denormalised column can drift - a crash between the event write and the
 * increment, say. This is the repair, and the reason the ledger is the truth.
 */
export const recomputeReputation = async (userId: string): Promise<number> => {
  const sum = await prisma.reputationEvent.aggregate({
    where: { userId },
    _sum: { delta: true },
  });

  const total = sum._sum.delta ?? 0;

  await prisma.user.update({
    where: { id: userId },
    data: { reputation: total },
    select: { id: true },
  });

  return total;
};
