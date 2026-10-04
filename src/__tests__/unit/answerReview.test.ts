/**
 * CC-72 stage 2: moderating and accepting answers, without HTTP - including
 * the two reputation reversals the extraction exposed and fixed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const tx = {
    answer: { update: vi.fn(async (a: { where: { id: string } }) => ({ id: a.where.id })) },
    doubt: { update: vi.fn(async () => ({ id: "d1" })) },
    studentProfile: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  return {
    tx,
    prisma: {
      answer: { findUnique: vi.fn(), update: vi.fn() },
      doubt: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
const reputation = vi.hoisted(() => ({
  ReputationReason: { ANSWER_APPROVED: "answer.approved", ANSWER_ACCEPTED: "answer.accepted" },
  awardReputation: vi.fn(async () => ({ awarded: true })),
  revokeReputation: vi.fn(async () => ({ awarded: true })),
}));
const notify = vi.hoisted(() => ({ notifyDoubtAnswer: vi.fn(async () => undefined) }));

vi.mock("../../config/database.js", () => ({ prisma: db.prisma }));
vi.mock("../../services/reputation/reputation.js", () => reputation);
vi.mock("../../utils/notifications.js", () => notify);

const { AnswerReviewError, moderateAnswer, toggleAcceptedAnswer } = await import(
  "../../services/doubts/answerReview.js"
);

const moderated = {
  id: "a1",
  doubt: { id: "d1", title: "Q", postedById: "asker" },
  answeredBy: { id: "author", name: "Ravi" },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.answer.update.mockResolvedValue(moderated);
  db.prisma.$transaction.mockImplementation(async (fn: (t: typeof db.tx) => unknown) => fn(db.tx));
});

describe("moderateAnswer", () => {
  const studentAnswer = (over = {}) => ({
    approvalStatus: "PENDING",
    moderatedById: null,
    answeredBy: { role: "STUDENT" },
    ...over,
  });

  it("approves, awards the floor points, and tells the asker", async () => {
    db.prisma.answer.findUnique.mockResolvedValue(studentAnswer());
    await moderateAnswer({ answerId: "a1", decision: "APPROVED", moderatorId: "fac" });

    expect(reputation.awardReputation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author", reason: "answer.approved", actorId: "fac" }),
    );
    expect(notify.notifyDoubtAnswer).toHaveBeenCalledWith("asker", "Q", "Ravi", "d1");
  });

  /** The fix: an approval that is reversed takes its points back. */
  it("revokes the approval points when an approved answer is rejected", async () => {
    db.prisma.answer.findUnique.mockResolvedValue(
      studentAnswer({ approvalStatus: "APPROVED", moderatedById: "fac" }),
    );
    await moderateAnswer({ answerId: "a1", decision: "REJECTED", moderatorId: "fac" });

    expect(reputation.revokeReputation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author", reason: "answer.approved", sourceId: "a1" }),
    );
    expect(reputation.awardReputation).not.toHaveBeenCalled();
    expect(notify.notifyDoubtAnswer).not.toHaveBeenCalled();
  });

  it("does not revoke when rejecting an answer that was never approved", async () => {
    db.prisma.answer.findUnique.mockResolvedValue(studentAnswer());
    await moderateAnswer({ answerId: "a1", decision: "REJECTED", moderatorId: "fac" });
    expect(reputation.revokeReputation).not.toHaveBeenCalled();
  });

  it("refuses to moderate a faculty answer, or to overrule another moderator", async () => {
    db.prisma.answer.findUnique.mockResolvedValue(studentAnswer({ answeredBy: { role: "FACULTY" } }));
    await expect(
      moderateAnswer({ answerId: "a1", decision: "APPROVED", moderatorId: "fac" }),
    ).rejects.toMatchObject({ status: 400 });

    db.prisma.answer.findUnique.mockResolvedValue(studentAnswer({ moderatedById: "other" }));
    await expect(
      moderateAnswer({ answerId: "a1", decision: "APPROVED", moderatorId: "fac" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.prisma.answer.update).not.toHaveBeenCalled();
  });

  it("only accepts APPROVED or REJECTED", async () => {
    await expect(
      moderateAnswer({ answerId: "a1", decision: "PENDING", moderatorId: "fac" }),
    ).rejects.toBeInstanceOf(AnswerReviewError);
  });
});

describe("toggleAcceptedAnswer", () => {
  const doubt = (over = {}) => ({ postedById: "asker", acceptedAnswerId: null, answerCount: 2, ...over });

  it("accepts: resolves the doubt, counts it solved, awards the points", async () => {
    db.prisma.doubt.findUnique.mockResolvedValue(doubt());
    db.prisma.answer.findUnique.mockResolvedValue({ doubtId: "d1", isAccepted: false, answeredById: "author" });

    const result = await toggleAcceptedAnswer({ doubtId: "d1", answerId: "a1", askerId: "asker" });

    expect(result.message).toBe("Answer marked as accepted");
    expect(db.tx.doubt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { acceptedAnswerId: "a1", status: "RESOLVED" } }),
    );
    expect(reputation.awardReputation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author", reason: "answer.accepted", sourceId: "a1" }),
    );
  });

  /** The fix: un-accepting takes the acceptance points back. */
  it("un-accepts: reopens the doubt and revokes the points", async () => {
    db.prisma.doubt.findUnique.mockResolvedValue(doubt({ acceptedAnswerId: "a1" }));
    db.prisma.answer.findUnique.mockResolvedValue({ doubtId: "d1", isAccepted: true, answeredById: "author" });

    const result = await toggleAcceptedAnswer({ doubtId: "d1", answerId: "a1", askerId: "asker" });

    expect(result.message).toBe("Answer unaccepted successfully");
    expect(db.tx.doubt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { acceptedAnswerId: null, status: "ANSWERED" } }),
    );
    expect(reputation.revokeReputation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author", sourceId: "a1" }),
    );
  });

  /** The fix, second half: moving the acceptance moves the points. */
  it("moving acceptance to another answer revokes from the first author", async () => {
    db.prisma.doubt.findUnique.mockResolvedValue(doubt({ acceptedAnswerId: "a-old" }));
    db.prisma.answer.findUnique
      .mockResolvedValueOnce({ doubtId: "d1", isAccepted: false, answeredById: "new-author" })
      .mockResolvedValueOnce({ id: "a-old", answeredById: "old-author" });

    await toggleAcceptedAnswer({ doubtId: "d1", answerId: "a1", askerId: "asker" });

    expect(db.tx.answer.update).toHaveBeenCalledWith({ where: { id: "a-old" }, data: { isAccepted: false } });
    expect(reputation.revokeReputation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "old-author", sourceId: "a-old" }),
    );
    expect(reputation.awardReputation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "new-author", sourceId: "a1" }),
    );
    // Everything that flips a flag happened inside the one transaction.
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("only the asker may accept, and only an answer to this doubt", async () => {
    db.prisma.doubt.findUnique.mockResolvedValue(doubt());
    await expect(
      toggleAcceptedAnswer({ doubtId: "d1", answerId: "a1", askerId: "someone" }),
    ).rejects.toMatchObject({ status: 403 });

    db.prisma.doubt.findUnique.mockResolvedValue(doubt());
    db.prisma.answer.findUnique.mockResolvedValue({ doubtId: "other", isAccepted: false, answeredById: "x" });
    await expect(
      toggleAcceptedAnswer({ doubtId: "d1", answerId: "a1", askerId: "asker" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
