/**
 * Faculty performance statistics (CC-26).
 *
 * PRIVATE BY DESIGN. A faculty member sees their own numbers; admins see
 * everyone's. There is deliberately no endpoint that ranks named faculty for
 * anyone else: a public leaderboard rewards answering many easy doubts, and
 * creates political risk with the people who approve the deployment. The only
 * thing shown beyond the individual is a department median, and only when the
 * department is large enough that it does not identify anybody.
 *
 * Medians, not means, throughout. One complaint left open over a vacation
 * would otherwise dominate a quarter's "average resolution time".
 *
 * See docs/specs/CC-26-faculty-stats.md.
 */

import { ApprovalStatus, Role } from "@prisma/client";
import { prisma } from "../../config/database.js";

/** Windows a caller may ask for. Anything else falls back to the default. */
export const STATS_WINDOWS = [30, 90, 365] as const;
export type StatsWindow = (typeof STATS_WINDOWS)[number];
export const DEFAULT_STATS_WINDOW: StatsWindow = 90;

/**
 * Fewer faculty than this in a department and no department figure is shown.
 * With two members, "the department median" plus your own number is the
 * other person's number.
 */
export const DEPARTMENT_MIN_SIZE = 3;

/** A timing figure below this many samples is reported as null, not a number. */
export const MIN_SAMPLE = 3;

export interface Timing {
  medianHours: number | null;
  p90Hours?: number | null;
  sampleSize: number;
}

export interface FacultyStats {
  userId: string;
  doubts: {
    answersPosted: number;
    doubtsAnswered: number;
    acceptedAnswers: number;
    upvotesReceived: number;
    /** Doubt posted -> this person's first answer to it. */
    responseTime: Timing;
  };
  moderation: {
    /** Student answers this person approved or rejected. */
    answersReviewed: number;
    reviewTime: Timing;
    draftsReviewed: number;
    draftsApproved: number;
    draftsEditedOnApproval: number;
  };
  complaints: {
    assigned: number;
    resolved: number;
    openNow: number;
    escalated: number;
    /** Assigned -> marked resolved. */
    resolutionTime: Timing;
    sla: { tracked: number; met: number; rate: number | null };
    rating: { average: number | null; count: number };
  };
}

export interface DepartmentBenchmark {
  department: string;
  facultyCount: number;
  responseTimeMedianHours: number | null;
  resolutionTimeMedianHours: number | null;
  slaRate: number | null;
  averageRating: number | null;
}

export const parseWindow = (raw: unknown): StatsWindow => {
  const days = Number(raw);
  return (STATS_WINDOWS as readonly number[]).includes(days)
    ? (days as StatsWindow)
    : DEFAULT_STATS_WINDOW;
};

const windowStart = (days: StatsWindow, now = new Date()): Date =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const hours = (seconds: unknown): number | null =>
  seconds === null || seconds === undefined
    ? null
    : Math.round((Number(seconds) / 3600) * 10) / 10;

/** A timing, withheld when the sample is too small to mean anything. */
const timing = (
  sampleSize: number,
  medianSeconds: unknown,
  p90Seconds?: unknown,
): Timing => {
  const enough = sampleSize >= MIN_SAMPLE;
  const result: Timing = {
    medianHours: enough ? hours(medianSeconds) : null,
    sampleSize,
  };
  if (p90Seconds !== undefined) result.p90Hours = enough ? hours(p90Seconds) : null;
  return result;
};

const emptyStats = (userId: string): FacultyStats => ({
  userId,
  doubts: {
    answersPosted: 0,
    doubtsAnswered: 0,
    acceptedAnswers: 0,
    upvotesReceived: 0,
    responseTime: { medianHours: null, p90Hours: null, sampleSize: 0 },
  },
  moderation: {
    answersReviewed: 0,
    reviewTime: { medianHours: null, sampleSize: 0 },
    draftsReviewed: 0,
    draftsApproved: 0,
    draftsEditedOnApproval: 0,
  },
  complaints: {
    assigned: 0,
    resolved: 0,
    openNow: 0,
    escalated: 0,
    resolutionTime: { medianHours: null, sampleSize: 0 },
    sla: { tracked: 0, met: 0, rate: null },
    rating: { average: null, count: 0 },
  },
});

/**
 * Statistics for a set of faculty over one window.
 *
 * One query per area, each grouped by user, so the admin overview costs the
 * same four queries for forty faculty as for one.
 */
export const computeFacultyStats = async (
  userIds: string[],
  days: StatsWindow,
  now = new Date(),
): Promise<Map<string, FacultyStats>> => {
  const result = new Map(userIds.map((id) => [id, emptyStats(id)]));
  if (userIds.length === 0) return result;

  const since = windowStart(days, now);

  const [answers, responses, moderation, drafts, complaints] = await Promise.all([
    prisma.$queryRaw<
      Array<{ uid: string; posted: number; accepted: number; upvotes: number }>
    >`
      SELECT "answeredById" AS uid,
             COUNT(*)::int AS posted,
             COUNT(*) FILTER (WHERE "isAccepted")::int AS accepted,
             COALESCE(SUM(upvotes), 0)::int AS upvotes
        FROM "Answer"
       WHERE "answeredById" = ANY(${userIds}::text[])
         AND "createdAt" >= ${since}
       GROUP BY 1`,

    // First answer per doubt, so a faculty member who answers and then
    // follows up is not credited with an instant second response.
    prisma.$queryRaw<
      Array<{ uid: string; n: number; median_s: number | null; p90_s: number | null }>
    >`
      WITH firsts AS (
        SELECT a."answeredById" AS uid, a."doubtId", MIN(a."createdAt") AS answered_at
          FROM "Answer" a
         WHERE a."answeredById" = ANY(${userIds}::text[])
           AND a."createdAt" >= ${since}
         GROUP BY 1, 2
      )
      SELECT f.uid,
             COUNT(*)::int AS n,
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM f.answered_at - d."createdAt"))::float8 AS median_s,
             percentile_cont(0.9) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM f.answered_at - d."createdAt"))::float8 AS p90_s
        FROM firsts f
        JOIN "Doubt" d ON d.id = f."doubtId"
       GROUP BY f.uid`,

    // Excludes reviewing one's own answer, which is not moderation.
    prisma.$queryRaw<Array<{ uid: string; n: number; median_s: number | null }>>`
      SELECT "moderatedById" AS uid,
             COUNT(*)::int AS n,
             percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM "moderatedAt" - "createdAt"))::float8 AS median_s
        FROM "Answer"
       WHERE "moderatedById" = ANY(${userIds}::text[])
         AND "moderatedAt" >= ${since}
         AND "answeredById" <> "moderatedById"
       GROUP BY 1`,

    prisma.$queryRaw<
      Array<{ uid: string; reviewed: number; approved: number; edited: number }>
    >`
      SELECT "reviewedById" AS uid,
             COUNT(*)::int AS reviewed,
             COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
             COUNT(*) FILTER (WHERE status = 'APPROVED' AND "editedOnApproval")::int AS edited
        FROM "AnswerDraft"
       WHERE "reviewedById" = ANY(${userIds}::text[])
         AND "reviewedAt" >= ${since}
       GROUP BY 1`,

    // "Resolved" is the faculty member marking it done (PENDING_CONFIRMATION
    // or later). Student confirmation is the student's latency, not theirs.
    prisma.$queryRaw<
      Array<{
        uid: string;
        assigned: number;
        resolved: number;
        open_now: number;
        escalated: number;
        timed: number;
        median_s: number | null;
        sla_tracked: number;
        sla_met: number;
        rating_avg: number | null;
        rating_n: number;
      }>
    >`
      WITH c AS (
        SELECT *,
               status::text IN ('PENDING_CONFIRMATION', 'RESOLVED')
                 AND "resolutionDate" >= ${since} AS resolved_in_window
          FROM "Complaint"
         WHERE "assignedToId" = ANY(${userIds}::text[])
      )
      SELECT "assignedToId" AS uid,
             COUNT(*) FILTER (WHERE "assignedAt" >= ${since})::int AS assigned,
             COUNT(*) FILTER (WHERE resolved_in_window)::int AS resolved,
             COUNT(*) FILTER (WHERE status::text IN ('ASSIGNED', 'IN_PROGRESS'))::int AS open_now,
             COUNT(*) FILTER (WHERE "escalationCount" > 0 AND "assignedAt" >= ${since})::int AS escalated,
             COUNT(*) FILTER (WHERE resolved_in_window AND "assignedAt" IS NOT NULL)::int AS timed,
             (percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM "resolutionDate" - "assignedAt"))
               FILTER (WHERE resolved_in_window AND "assignedAt" IS NOT NULL))::float8 AS median_s,
             COUNT(*) FILTER (WHERE resolved_in_window AND "slaDueAt" IS NOT NULL)::int AS sla_tracked,
             COUNT(*) FILTER (WHERE resolved_in_window AND "slaDueAt" IS NOT NULL
                                AND "resolutionDate" <= "slaDueAt")::int AS sla_met,
             (AVG("feedbackRating") FILTER (WHERE resolved_in_window
                                             AND "feedbackRating" IS NOT NULL))::float8 AS rating_avg,
             COUNT(*) FILTER (WHERE resolved_in_window AND "feedbackRating" IS NOT NULL)::int AS rating_n
        FROM c
       GROUP BY 1`,
  ]);

  for (const row of answers) {
    const stats = result.get(row.uid);
    if (!stats) continue;
    stats.doubts.answersPosted = row.posted;
    stats.doubts.acceptedAnswers = row.accepted;
    stats.doubts.upvotesReceived = row.upvotes;
  }

  for (const row of responses) {
    const stats = result.get(row.uid);
    if (!stats) continue;
    stats.doubts.doubtsAnswered = row.n;
    stats.doubts.responseTime = timing(row.n, row.median_s, row.p90_s);
  }

  for (const row of moderation) {
    const stats = result.get(row.uid);
    if (!stats) continue;
    stats.moderation.answersReviewed = row.n;
    stats.moderation.reviewTime = timing(row.n, row.median_s);
  }

  for (const row of drafts) {
    const stats = result.get(row.uid);
    if (!stats) continue;
    stats.moderation.draftsReviewed = row.reviewed;
    stats.moderation.draftsApproved = row.approved;
    stats.moderation.draftsEditedOnApproval = row.edited;
  }

  for (const row of complaints) {
    const stats = result.get(row.uid);
    if (!stats) continue;
    stats.complaints = {
      assigned: row.assigned,
      resolved: row.resolved,
      openNow: row.open_now,
      escalated: row.escalated,
      resolutionTime: timing(row.timed, row.median_s),
      sla: {
        tracked: row.sla_tracked,
        met: row.sla_met,
        rate:
          row.sla_tracked >= MIN_SAMPLE
            ? Math.round((row.sla_met / row.sla_tracked) * 100) / 100
            : null,
      },
      rating: {
        average:
          row.rating_n >= MIN_SAMPLE && row.rating_avg !== null
            ? Math.round(Number(row.rating_avg) * 10) / 10
            : null,
        count: row.rating_n,
      },
    };
  }

  return result;
};

/** Median of the non-null values, or null when there are none. */
export const median = (values: Array<number | null>): number | null => {
  const sorted = values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(value * 100) / 100;
};

/** Approved, active faculty, optionally narrowed to one department. */
export const listFaculty = (department?: string) =>
  prisma.user.findMany({
    where: {
      role: Role.FACULTY,
      approvalStatus: ApprovalStatus.APPROVED,
      erasedAt: null,
      ...(department ? { facultyProfile: { department } } : {}),
    },
    select: {
      id: true,
      name: true,
      userID: true,
      facultyProfile: { select: { department: true, isTeaching: true } },
    },
    orderBy: { name: "asc" },
  });

/**
 * The department's medians, or null when the department is too small to
 * publish one without identifying its members.
 */
export const departmentBenchmark = async (
  department: string,
  days: StatsWindow,
  now = new Date(),
): Promise<DepartmentBenchmark | null> => {
  const members = await listFaculty(department);
  if (members.length < DEPARTMENT_MIN_SIZE) return null;

  const stats = [
    ...(await computeFacultyStats(members.map((m) => m.id), days, now)).values(),
  ];

  return {
    department,
    facultyCount: members.length,
    responseTimeMedianHours: median(
      stats.map((s) => s.doubts.responseTime.medianHours),
    ),
    resolutionTimeMedianHours: median(
      stats.map((s) => s.complaints.resolutionTime.medianHours),
    ),
    slaRate: median(stats.map((s) => s.complaints.sla.rate)),
    averageRating: median(stats.map((s) => s.complaints.rating.average)),
  };
};
