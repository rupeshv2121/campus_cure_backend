/**
 * Helpers shared by the admin controllers.
 *
 * Split out of adminController.ts by CC-72; the handlers are unchanged.
 * See docs/specs/CC-72-controller-split.md.
 */

import { prisma } from "../../config/database.js";

export const DEFAULT_DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Mechanical",
];

export const DEFAULT_ALLOWED_CATEGORIES = [
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

export const sanitizeStringArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  );
};

export const getDoubtSubjectsByUserId = async (userId: string): Promise<string[]> => {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ doubtSubjects: string[] | null }>
    >`
      SELECT "doubtSubjects"
      FROM "AdminProfile"
      WHERE "userId" = ${userId}
      LIMIT 1
    `;

    const subjects = rows[0]?.doubtSubjects;
    return Array.isArray(subjects) && subjects.length > 0
      ? subjects
      : DEFAULT_DOUBT_SUBJECTS;
  } catch {
    // If column/client is temporarily out of sync, fall back safely.
    return DEFAULT_DOUBT_SUBJECTS;
  }
};

export const setDoubtSubjectsByUserId = async (
  userId: string,
  subjects: string[],
): Promise<void> => {
  try {
    await prisma.$executeRaw`
      UPDATE "AdminProfile"
      SET "doubtSubjects" = ${subjects}, "updatedAt" = NOW()
      WHERE "userId" = ${userId}
    `;
  } catch {
    // No-op to avoid hard-failing settings when deployment/client is out of sync.
  }
};
