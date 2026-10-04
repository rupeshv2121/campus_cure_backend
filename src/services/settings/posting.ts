/**
 * What students may post (CC-72 stage 2): the complaint categories and doubt
 * subjects a super admin has configured, with defaults when none are set.
 *
 * Moved out of controllers/student/shared.ts so services - complaint filing
 * first - can check against it without importing a controller.
 */

import { Role } from "@prisma/client";
import { prisma } from "../../config/database.js";

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
