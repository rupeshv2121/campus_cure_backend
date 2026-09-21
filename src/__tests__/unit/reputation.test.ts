/**
 * CC-25: reputation.
 *
 * Most of this file is about the three ways to farm points and what stops
 * each. Two are structural — self-awards score zero, and a unique index
 * allows one award per actor per source. The third, the daily cap, is a
 * judgement, which is why it gets the most tests.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    reputationEvent: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    user: { update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

const env = vi.hoisted(() => ({
  REPUTATION_ENABLED: true,
  REPUTATION_DAILY_CAP: 50,
}));

vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => env);

import {
  POINTS,
  ReputationReason,
  awardReputation,
  getLeaderboard,
  nextRank,
  rankFor,
  recomputeReputation,
  revokeReputation,
} from "../../services/reputation/reputation.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const argOf = (fn: { mock: { calls: any[][] } }, call = 0): any =>
  fn.mock.calls[call]![0];

const award = (over: Record<string, unknown> = {}) =>
  awardReputation({
    userId: "author-1",
    reason: ReputationReason.ANSWER_UPVOTED,
    sourceType: "Answer",
    sourceId: "ans-1",
    actorId: "voter-1",
    ...over,
  } as Parameters<typeof awardReputation>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  env.REPUTATION_ENABLED = true;
  env.REPUTATION_DAILY_CAP = 50;
  db.prisma.reputationEvent.aggregate.mockResolvedValue({ _sum: { delta: 0 } });
  db.prisma.reputationEvent.create.mockResolvedValue({});
  db.prisma.user.update.mockResolvedValue({});
});

describe("points and ranks", () => {
  it("values answering about five times asking", () => {
    // A forum where asking scores well fills with questions and empties of
    // answers.
    expect(POINTS["answer.upvoted"]).toBe(10);
    expect(POINTS["doubt.upvoted"]).toBe(2);
    expect(POINTS["answer.upvoted"]).toBeGreaterThan(
      POINTS["doubt.upvoted"] * 4,
    );
  });

  it("values acceptance above a plain upvote", () => {
    expect(POINTS["answer.accepted"]).toBeGreaterThan(POINTS["answer.upvoted"]);
  });

  it("treats passing moderation as a floor, not an achievement", () => {
    expect(POINTS["answer.approved"]).toBeLessThan(POINTS["answer.upvoted"]);
  });

  it("derives rank at each threshold", () => {
    expect(rankFor(0)).toBe("Newcomer");
    expect(rankFor(49)).toBe("Newcomer");
    expect(rankFor(50)).toBe("Contributor");
    expect(rankFor(150)).toBe("Helper");
    expect(rankFor(400)).toBe("Mentor");
    expect(rankFor(1000)).toBe("Expert");
    expect(rankFor(99999)).toBe("Expert");
  });

  it("reports how far the next rank is, and nothing at the top", () => {
    expect(nextRank(0)).toEqual({ name: "Contributor", needed: 50 });
    expect(nextRank(120)).toEqual({ name: "Helper", needed: 30 });
    expect(nextRank(1200)).toBeNull();
  });
});

describe("awardReputation", () => {
  it("writes a ledger row and bumps the total", async () => {
    await expect(award()).resolves.toEqual({ awarded: true, delta: 10 });

    expect(argOf(db.prisma.reputationEvent.create).data).toMatchObject({
      userId: "author-1",
      delta: 10,
      reason: "answer.upvoted",
      sourceId: "ans-1",
      actorId: "voter-1",
    });
    expect(argOf(db.prisma.user.update).data).toEqual({
      reputation: { increment: 10 },
    });
  });

  it("pays nothing for upvoting yourself", async () => {
    const result = await award({ actorId: "author-1" });

    expect(result).toEqual({ awarded: false, reason: "self" });
    expect(db.prisma.reputationEvent.create).not.toHaveBeenCalled();
  });

  it("treats a duplicate as the unique index doing its job, not a fault", async () => {
    db.prisma.reputationEvent.create.mockRejectedValueOnce({ code: "P2002" });

    await expect(award()).resolves.toEqual({
      awarded: false,
      reason: "already-awarded",
    });
    // The total must not move for an award that did not happen.
    expect(db.prisma.user.update).not.toHaveBeenCalled();
  });

  it("stops paying at the daily cap", async () => {
    db.prisma.reputationEvent.aggregate.mockResolvedValueOnce({
      _sum: { delta: 50 },
    });

    await expect(award()).resolves.toEqual({
      awarded: false,
      reason: "daily-cap",
    });
    expect(db.prisma.reputationEvent.create).not.toHaveBeenCalled();
  });

  it("still pays just below the cap", async () => {
    db.prisma.reputationEvent.aggregate.mockResolvedValueOnce({
      _sum: { delta: 49 },
    });

    await expect(award()).resolves.toMatchObject({ awarded: true });
  });

  it("counts only today's positive events toward the cap", async () => {
    await award();

    const where = argOf(db.prisma.reputationEvent.aggregate).where;
    expect(where.delta).toEqual({ gt: 0 });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.gte.getHours()).toBe(0);
  });

  it("does nothing at all when disabled", async () => {
    env.REPUTATION_ENABLED = false;

    await expect(award()).resolves.toEqual({
      awarded: false,
      reason: "disabled",
    });
    expect(db.prisma.reputationEvent.aggregate).not.toHaveBeenCalled();
  });

  it("NEVER throws — a missing point beats a broken button", async () => {
    db.prisma.reputationEvent.create.mockRejectedValueOnce(new Error("db down"));

    await expect(award()).resolves.toEqual({ awarded: false, reason: "error" });
  });

  it("uses the surrounding transaction when given one", async () => {
    const tx = {
      reputationEvent: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { delta: 0 } }),
        create: vi.fn().mockResolvedValue({}),
      },
      user: { update: vi.fn().mockResolvedValue({}) },
    };

    await award({ tx: tx as never });

    expect(tx.reputationEvent.create).toHaveBeenCalledOnce();
    expect(db.prisma.reputationEvent.create).not.toHaveBeenCalled();
  });
});

describe("revokeReputation", () => {
  const revoke = () =>
    revokeReputation({
      userId: "author-1",
      reason: ReputationReason.ANSWER_UPVOTED,
      sourceType: "Answer",
      sourceId: "ans-1",
      actorId: "voter-1",
    });

  it("deletes the event and takes the points back", async () => {
    db.prisma.reputationEvent.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      delta: 10,
    });
    db.prisma.reputationEvent.delete.mockResolvedValueOnce({});

    await expect(revoke()).resolves.toEqual({ awarded: true, delta: -10 });
    expect(argOf(db.prisma.user.update).data).toEqual({
      reputation: { decrement: 10 },
    });
  });

  it("deletes rather than writing a compensating negative", async () => {
    db.prisma.reputationEvent.findFirst.mockResolvedValueOnce({
      id: "ev-1",
      delta: 10,
    });
    db.prisma.reputationEvent.delete.mockResolvedValueOnce({});

    await revoke();

    // The event did not happen any more. A +10 and a -10 makes "why do I have
    // this score" harder to read, not easier.
    expect(db.prisma.reputationEvent.create).not.toHaveBeenCalled();
  });

  it("is a no-op when there was nothing to reverse", async () => {
    // A self-upvote being withdrawn, or one that was capped and never scored.
    db.prisma.reputationEvent.findFirst.mockResolvedValueOnce(null);

    await expect(revoke()).resolves.toEqual({
      awarded: false,
      reason: "not-found",
    });
    expect(db.prisma.user.update).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    db.prisma.reputationEvent.findFirst.mockRejectedValueOnce(
      new Error("db down"),
    );

    await expect(revoke()).resolves.toMatchObject({ awarded: false });
  });
});

describe("getLeaderboard", () => {
  beforeEach(() => {
    db.prisma.user.findMany.mockResolvedValue([
      { id: "u-1", name: "A", userID: "S1", role: "STUDENT", reputation: 200 },
      { id: "u-2", name: "B", userID: "S2", role: "STUDENT", reputation: 40 },
    ]);
  });

  it("numbers positions and attaches a rank", async () => {
    const board = await getLeaderboard();

    expect(board[0]).toMatchObject({ position: 1, rank: "Helper" });
    expect(board[1]).toMatchObject({ position: 2, rank: "Newcomer" });
  });

  it("excludes erased and inactive accounts, and zero scores", async () => {
    await getLeaderboard();

    expect(argOf(db.prisma.user.findMany).where).toEqual({
      reputation: { gt: 0 },
      erasedAt: null,
      isActive: true,
    });
  });

  it("caps how many rows it will return", async () => {
    await getLeaderboard(5000);

    expect(argOf(db.prisma.user.findMany).take).toBe(100);
  });
});

describe("recomputeReputation", () => {
  it("repairs the denormalised total from the ledger", async () => {
    db.prisma.reputationEvent.aggregate.mockResolvedValueOnce({
      _sum: { delta: 275 },
    });

    await expect(recomputeReputation("u-1")).resolves.toBe(275);
    expect(argOf(db.prisma.user.update).data).toEqual({ reputation: 275 });
  });

  it("treats an empty ledger as zero, not as null", async () => {
    db.prisma.reputationEvent.aggregate.mockResolvedValueOnce({
      _sum: { delta: null },
    });

    await expect(recomputeReputation("u-1")).resolves.toBe(0);
  });
});
