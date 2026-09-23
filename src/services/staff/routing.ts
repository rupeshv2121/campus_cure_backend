/**
 * Who should fix this? — CC-27.
 *
 * ## The bug this exists to fix
 *
 * The rules table deleted before CC-14 mapped complaint categories to
 * *teaching faculty by department*, so a broken fan was routed to a lecturer in
 * Electrical Engineering. Fans are fixed by electricians. CC-14 replaced the
 * routing table but not the underlying problem: non-teaching staff did not
 * exist as first-class targets, so CC-14 could classify a complaint perfectly
 * and still hand it to the wrong kind of person.
 *
 * `FacultyProfile.isTeaching` had existed since before any of this and was
 * settable through the profile API — but **nothing ever read it**.
 * `getApprovedFaculty` returned every approved faculty member, in name order,
 * with no indication of who does what. An admin assigning "broken fan in ML02"
 * saw a flat list of lecturers.
 *
 * ## What this does instead
 *
 * Ranks candidates against the complaint's category, using a field staff
 * declare about themselves (`handlesCategories`, in CC-14's own category
 * vocabulary so the two cannot drift).
 *
 * It **ranks, never auto-assigns**. The same reasoning as CC-14 and CC-50: the
 * system suggests, a human decides. Auto-assignment would need to be right
 * about workload, leave, shift and competence, and it is not — what it can do
 * is stop an electrician being invisible in a list of eighty lecturers.
 */
import { ApprovalStatus, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";

/**
 * CC-14's categories, re-exported rather than redefined.
 *
 * A second copy of this list is how routing starts accepting a category intake
 * never produces, or rejecting one it does.
 */
export { type Category } from "../intake/rules.js";

export const ROUTABLE_CATEGORIES = [
  "FAN",
  "LIGHT",
  "SMART_BOARD",
  "NETWORK",
  "SEATING",
  "FURNITURE",
  "OTHER",
] as const;

export const isRoutableCategory = (value: unknown): value is string =>
  typeof value === "string" &&
  (ROUTABLE_CATEGORIES as readonly string[]).includes(value);

/** Why a candidate is ranked where they are, in words the UI can show. */
export type MatchReason =
  | "handles-category-same-department"
  | "handles-category"
  | "non-teaching-general"
  | "teaching-fallback";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  department: string | null;
  staffRole: string | null;
  isTeaching: boolean;
  handlesCategories: string[];
  /** Open complaints already assigned to them. */
  openLoad: number;
  reason: MatchReason;
  score: number;
}

/**
 * Ranking weights.
 *
 * Declaring the category is worth far more than anything else, because it is
 * the only signal that is actually *about the work*. Department is a tiebreak,
 * not a qualification — an electrician from another department still fixes
 * fans better than a nearby lecturer does.
 */
const SCORES: Record<MatchReason, number> = {
  "handles-category-same-department": 100,
  "handles-category": 80,
  "non-teaching-general": 40,
  "teaching-fallback": 10,
};

/**
 * Statuses that still occupy someone's time.
 *
 * Used only as a tiebreak within a reason band. It must never let a lecturer
 * outrank an electrician for being idle — which is why load is applied after
 * the band, not mixed into it.
 */
const OPEN_STATUSES = [
  "RAISED",
  "ASSIGNED",
  "IN_PROGRESS",
  "ESCALATED_TO_SUPERADMIN",
];

const classify = (
  profile: { isTeaching: boolean; handlesCategories: string[]; department: string },
  category: string | null,
  complaintDepartment: string | null,
): MatchReason => {
  const declaresCategory =
    category !== null && profile.handlesCategories.includes(category);

  if (declaresCategory) {
    return complaintDepartment && profile.department === complaintDepartment
      ? "handles-category-same-department"
      : "handles-category";
  }

  // Non-teaching staff who have not declared this category are still a better
  // guess than a lecturer: they are maintenance staff of some kind, and the
  // declaration may simply be incomplete.
  return profile.isTeaching ? "teaching-fallback" : "non-teaching-general";
};

export interface RankOptions {
  /** The complaint's CC-14 category. Null ranks on role alone. */
  category: string | null;
  /** Used only as a tiebreak. */
  department?: string | null;
  limit?: number;
}

/**
 * Rank assignable staff for a complaint.
 *
 * Returns everyone who could take it, best first — never a filtered list. An
 * admin must always be able to assign whoever they judge right, including a
 * lecturer: the ranking is advice, and a list that hides people would turn a
 * wrong `handlesCategories` value into an unfixable complaint.
 */
export const rankCandidates = async (
  options: RankOptions,
): Promise<Candidate[]> => {
  const category = isRoutableCategory(options.category)
    ? options.category
    : null;

  const staff = await prisma.user.findMany({
    where: {
      role: Role.FACULTY,
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true,
      facultyProfile: { isNot: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      facultyProfile: {
        select: {
          department: true,
          isTeaching: true,
          staffRole: true,
          handlesCategories: true,
        },
      },
    },
  });

  if (staff.length === 0) return [];

  // One grouped query for the whole page rather than a count per candidate.
  const loads = await prisma.complaint.groupBy({
    by: ["assignedToId"],
    where: {
      assignedToId: { in: staff.map((member) => member.id) },
      status: { in: OPEN_STATUSES as never },
    },
    _count: { _all: true },
  });

  const loadById = new Map(
    loads.map((row) => [row.assignedToId, row._count._all]),
  );

  const candidates: Candidate[] = staff.map((member) => {
    const profile = member.facultyProfile!;
    const reason = classify(profile, category, options.department ?? null);

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      department: profile.department,
      staffRole: profile.staffRole,
      isTeaching: profile.isTeaching,
      handlesCategories: profile.handlesCategories,
      openLoad: loadById.get(member.id) ?? 0,
      reason,
      score: SCORES[reason],
    };
  });

  candidates.sort(
    (a, b) =>
      // Band first: a qualified electrician with five open jobs still beats an
      // idle lecturer.
      b.score - a.score ||
      // Then spread the work within the band.
      a.openLoad - b.openLoad ||
      a.name.localeCompare(b.name),
  );

  return options.limit ? candidates.slice(0, options.limit) : candidates;
};

export interface DirectoryEntry {
  id: string;
  name: string;
  department: string;
  staffRole: string | null;
  isTeaching: boolean;
  handlesCategories: string[];
  subjects: string[];
  /** Present only because the person opted in. */
  email: string;
  phoneNumber: string | null;
}

/**
 * The staff directory.
 *
 * Only `directoryOptIn` profiles appear, and a profile that has not opted in
 * is **absent**, not present-with-blanks. Listing someone as "contact hidden"
 * still confirms they work here and in which department, which is more than
 * they agreed to share.
 *
 * `address` is never returned. It is on the profile for administrative use and
 * has no place in a directory that every student can read.
 */
export const listDirectory = async (filters: {
  category?: string | null;
  teaching?: boolean | null;
  query?: string | null;
}): Promise<DirectoryEntry[]> => {
  const category = isRoutableCategory(filters.category)
    ? filters.category
    : null;

  const staff = await prisma.user.findMany({
    where: {
      role: Role.FACULTY,
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true,
      facultyProfile: {
        directoryOptIn: true,
        ...(category ? { handlesCategories: { has: category } } : {}),
        ...(typeof filters.teaching === "boolean"
          ? { isTeaching: filters.teaching }
          : {}),
      },
      ...(filters.query
        ? { name: { contains: filters.query, mode: "insensitive" as const } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      facultyProfile: {
        select: {
          department: true,
          staffRole: true,
          isTeaching: true,
          handlesCategories: true,
          subjects: true,
          phoneNumber: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return staff.map((member) => {
    const profile = member.facultyProfile!;
    return {
      id: member.id,
      name: member.name,
      department: profile.department,
      staffRole: profile.staffRole,
      isTeaching: profile.isTeaching,
      handlesCategories: profile.handlesCategories,
      subjects: profile.subjects,
      email: member.email,
      // "Not Set" is the placeholder registration writes. Returning it as a
      // phone number would have students dialling a string.
      phoneNumber:
        profile.phoneNumber && profile.phoneNumber !== "Not Set"
          ? profile.phoneNumber
          : null,
    };
  });
};

/** Exposed for the test suite. */
export const __testing = { classify, SCORES, OPEN_STATUSES };
