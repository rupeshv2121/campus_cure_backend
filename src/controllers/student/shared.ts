/**
 * Helpers shared by the student controllers.
 *
 * Split out of studentController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import {
  Prisma
} from "@prisma/client";
import { prisma } from "../../config/database.js";

export const isTenDigitPhoneNumber = (value: unknown): boolean =>
  typeof value === "string" && /^\d{10}$/.test(value.trim());

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

// CC-72 stage 2: moved to services/settings/posting.ts; re-exported for the
// controllers that still import them from here.
export {
  DEFAULT_ALLOWED_COMPLAINT_CATEGORIES,
  DEFAULT_DOUBT_SUBJECTS,
  getLatestSuperAdminDoubtSubjects,
  getPostingSettings
} from "../../services/settings/posting.js";
