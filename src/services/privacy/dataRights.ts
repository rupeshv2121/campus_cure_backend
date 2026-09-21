/**
 * Data principal rights: consent, export and erasure (CC-64).
 *
 * See docs/specs/CC-64-dpdp.md.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "../../config/database.js";
import { DPDP_POLICY_VERSION } from "../../config/env.js";

/**
 * What the user is told their data is used for.
 *
 * Stored with each consent record rather than only rendered, so "what did I
 * agree to" is answerable from the record instead of from whatever the site
 * happens to say today.
 */
export const CONSENT_PURPOSES = [
  "account-and-authentication",
  "complaint-handling",
  "doubt-community",
  "service-notifications",
] as const;

export interface ConsentInput {
  userId: string;
  granted: boolean;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Record a grant or a withdrawal.
 *
 * Always a new row, never an update: the history is the point. Withdrawal
 * deliberately does NOT cascade to erasure — they are separate rights, and
 * conflating them would surprise someone who only wanted the emails to stop.
 */
export const recordConsent = async (input: ConsentInput) => {
  return prisma.consentRecord.create({
    data: {
      userId: input.userId,
      policyVersion: DPDP_POLICY_VERSION,
      granted: input.granted,
      purposes: [...CONSENT_PURPOSES],
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
};

/** The caller's consent history, newest first. */
export const getConsentHistory = (userId: string) =>
  prisma.consentRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

/**
 * Has this user consented to the CURRENT policy version?
 *
 * A version bump invalidates prior consent, which is the whole reason the
 * version is stored on the row rather than assumed.
 */
export const hasCurrentConsent = async (userId: string): Promise<boolean> => {
  const latest = await prisma.consentRecord.findFirst({
    where: { userId, policyVersion: DPDP_POLICY_VERSION },
    orderBy: { createdAt: "desc" },
  });

  return Boolean(latest?.granted);
};

/**
 * Everything held about one person, as JSON.
 *
 * Every field is listed explicitly. A `select` allow-list rather than an
 * exclusion list, because the failure mode of forgetting to exclude something
 * is shipping a credential to whoever is logged in — which is how a
 * portability feature becomes an account-takeover feature.
 */
export const exportUserData = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      userID: true,
      university: true,
      role: true,
      approvalStatus: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      erasedAt: true,
      emailNotifications: true,
      // NOT faceDescriptorEnc, NOT password. See below.
      faceDescriptorEnc: true,
      studentProfile: true,
      facultyProfile: true,
      adminProfile: true,
    },
  });

  if (!user) return null;

  const { faceDescriptorEnc, ...safeUser } = user;

  const [
    complaints,
    doubts,
    answers,
    notifications,
    consent,
    bookmarks,
    auditAsActor,
    auditAsTarget,
  ] = await Promise.all([
    prisma.complaint.findMany({
      where: { raisedById: userId },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        block: true,
        classroomNumber: true,
        status: true,
        priority: true,
        createdAt: true,
        resolutionNote: true,
        feedbackRating: true,
        feedbackComment: true,
      },
    }),
    prisma.doubt.findMany({
      where: { postedById: userId },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        semester: true,
        labels: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.answer.findMany({
      where: { answeredById: userId },
      select: {
        id: true,
        doubtId: true,
        content: true,
        approvalStatus: true,
        createdAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
    }),
    getConsentHistory(userId),
    prisma.doubtBookmark.findMany({
      where: { userId },
      select: { doubtId: true, savedAt: true },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId },
      select: {
        action: true,
        targetType: true,
        targetId: true,
        summary: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { targetType: "User", targetId: userId },
      select: {
        action: true,
        actorRole: true,
        summary: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    policyVersion: DPDP_POLICY_VERSION,
    /**
     * Stated, not shipped. The subject is entitled to know a biometric
     * template exists; handing over the template - even encrypted - would
     * export the thing CC-60 spent a feature protecting.
     */
    biometrics: {
      faceTemplateOnFile: Boolean(faceDescriptorEnc),
      note: "A face template exists but is never exported. It can be removed via DELETE /api/auth/face-descriptor.",
    },
    notIncluded: [
      "password hash",
      "face template",
      "refresh token hashes",
      "face challenge nonces",
    ],
    user: safeUser,
    complaints,
    doubts,
    answers,
    notifications,
    bookmarks,
    consent,
    auditTrail: { asActor: auditAsActor, aboutYou: auditAsTarget },
  };
};

export interface ErasureResult {
  alreadyErased: boolean;
  tombstone?: string;
  deleted?: Record<string, number>;
}

/**
 * Erase a person from the system.
 *
 * ANONYMISATION, NOT DELETION, for three independent reasons:
 *
 *  1. The database will not allow a hard delete. StudentProfile, Doubt, Answer
 *     and Complaint all reference User with no cascade, so DELETE raises a
 *     foreign key violation today.
 *  2. Deleting content destroys other people's data. A doubt with twelve
 *     answers is not only its author's, and DPDP grants erasure of personal
 *     data, not of everything a person ever touched.
 *  3. CC-61 made the audit log immutable on purpose. A trigger raises on
 *     UPDATE and DELETE, so no erasure can reach it - and a trail editable by
 *     the person it describes would not be a trail.
 *
 * Identifiers are replaced, purely personal rows are deleted, and content is
 * reattributed to a tombstone account.
 */
export const eraseUser = async (userId: string): Promise<ErasureResult> => {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, erasedAt: true },
  });

  if (!existing) throw new Error("User not found");

  // Idempotent: a second call must not mint a new tombstone or re-delete.
  if (existing.erasedAt) return { alreadyErased: true };

  const short = randomBytes(4).toString("hex");
  const tombstone = `deleted-${short}`;
  const erasedAt = new Date();

  const deleted: Record<string, number> = {};
  const count = async (key: string, run: Promise<{ count: number }>) => {
    deleted[key] = (await run).count;
  };

  // Purely personal, of no value to anyone else once the person is gone.
  await count("notifications", prisma.notification.deleteMany({ where: { userId } }));
  await count("bookmarks", prisma.doubtBookmark.deleteMany({ where: { userId } }));
  await count("doubtViews", prisma.doubtView.deleteMany({ where: { userId } }));
  await count("doubtUpvotes", prisma.doubtUpvote.deleteMany({ where: { userId } }));
  await count("answerUpvotes", prisma.answerUpvote.deleteMany({ where: { userId } }));
  await count("refreshTokens", prisma.refreshToken.deleteMany({ where: { userId } }));
  await count("faceChallenges", prisma.faceChallenge.deleteMany({ where: { userId } }));
  await count("consentRecords", prisma.consentRecord.deleteMany({ where: { userId } }));

  // Queued and sent mail carries both the address and the message body.
  if (existing.email) {
    await count(
      "emails",
      prisma.emailOutbox.deleteMany({
        where: { to: existing.email.toLowerCase() },
      }),
    );
  }

  // Contact details go; the academic shape of the record stays, because it is
  // not identifying on its own and the counters feed other people's views.
  await prisma.studentProfile
    .updateMany({
      where: { userId },
      data: {
        phoneNumber: "",
        address: "",
        guardianName: "",
        guardianPhone: "",
      },
    })
    .catch(() => undefined);

  await prisma.facultyProfile
    .updateMany({
      where: { userId },
      data: { phoneNumber: "", address: "" },
    })
    .catch(() => undefined);

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: tombstone,
      email: `${tombstone}@erased.invalid`,
      userID: tombstone,
      // Random and discarded: the account must be unreachable, not guessable.
      password: randomBytes(32).toString("hex"),
      // Biometric data has no retention justification whatsoever.
      faceDescriptorEnc: null,
      faceDescriptor: [],
      isActive: false,
      emailNotifications: false,
      unsubscribeToken: null,
      erasedAt,
    },
    select: { id: true },
  });

  return { alreadyErased: false, tombstone, deleted };
};
