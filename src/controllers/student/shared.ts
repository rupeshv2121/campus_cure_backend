/**
 * Helpers shared by the student controllers.
 *
 * Split out of studentController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  Prisma,
  Role
} from "@prisma/client";
import { prisma } from "../../config/database.js";

export const isTenDigitPhoneNumber = (value: unknown): boolean =>
  typeof value === "string" && /^\d{10}$/.test(value.trim());

export const DEFAULT_ALLOWED_COMPLAINT_CATEGORIES = [
  "PROJECTOR",
  "FAN",
  "LIGHT",
  "SMART_BOARD",
  "SEATING",
  "FURNITURE",
  "NETWORK",
  "OTHER",
];

export const DEFAULT_DOUBT_SUBJECTS = ["DSA", "DBMS", "OS", "NETWORKS"];

// The keyword scorer moved to services/search/keywordRetriever.ts in CC-11.
// It is the measured baseline for hybrid search, so it must have exactly one
// definition - two copies would silently drift apart.

export type CommonDoubtsWindow = "all" | "30d" | "90d";

export interface CommonDoubtCandidate {
  id: string;
  title: string;
  subject: string;
  views: number;
  upVoteCount: number;
  answerCount: number;
  createdAt: Date;
}

export interface CommonDoubtTopicBucket {
  key: string;
  label: string;
  count: number;
  engagementScore: number;
  newestAt: number;
  topDoubts: CommonDoubtCandidate[];
}

/**
 * CC-21: bookmark ids for one user across a page of doubts.
 *
 * Returns an empty set rather than throwing when the table is absent. The
 * DoubtBookmark migration may not be applied on every environment yet, and a
 * missing "save for later" flag must not take the whole doubt feed down with
 * it - the same tolerance the upvote read already has.
 */
export const readBookmarkedIds = async (
  userId: string,
  doubtIds: string[],
): Promise<Set<string>> => {
  if (doubtIds.length === 0) return new Set();

  try {
    const rows = await prisma.doubtBookmark.findMany({
      where: { userId, doubtId: { in: doubtIds } },
      select: { doubtId: true },
    });
    return new Set(rows.map((row) => row.doubtId));
  } catch (error) {
    if (isDoubtUpvoteSchemaMissingError(error)) return new Set();
    throw error;
  }
};

export const isDoubtUpvoteSchemaMissingError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
};

export const getLatestSuperAdminDoubtSubjects = async (): Promise<string[]> => {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ doubtSubjects: string[] | null }>
    >`
      SELECT "doubtSubjects"
      FROM "AdminProfile" ap
      JOIN "User" u ON u."id" = ap."userId"
      WHERE u."role" = 'SUPER_ADMIN'
      ORDER BY ap."updatedAt" DESC
      LIMIT 1
    `;

    const subjects = rows[0]?.doubtSubjects;
    return Array.isArray(subjects) && subjects.length > 0
      ? subjects
      : DEFAULT_DOUBT_SUBJECTS;
  } catch {
    return DEFAULT_DOUBT_SUBJECTS;
  }
};

export const getPostingSettings = async (): Promise<{
  allowedCategories: string[];
  doubtSubjects: string[];
}> => {
  const profile = await prisma.adminProfile.findFirst({
    where: {
      user: {
        role: Role.SUPER_ADMIN,
      },
    },
    select: {
      allowedCategories: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const doubtSubjects = await getLatestSuperAdminDoubtSubjects();

  return {
    allowedCategories:
      profile && profile.allowedCategories.length > 0
        ? profile.allowedCategories
        : DEFAULT_ALLOWED_COMPLAINT_CATEGORIES,
    doubtSubjects,
  };
};
