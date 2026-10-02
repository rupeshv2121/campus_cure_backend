/**
 * CC-26: faculty performance statistics.
 *
 * The SQL itself was checked against the live database when written; these
 * tests cover what the service does with the rows, and the two privacy rules:
 * small samples are withheld rather than reported, and a department too small
 * to anonymise gets no benchmark at all.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { findMany: vi.fn() },
  },
}));

vi.mock("../../config/database.js", () => db);

const {
  DEFAULT_STATS_WINDOW,
  computeFacultyStats,
  departmentBenchmark,
  median,
  parseWindow,
} = await import("../../services/faculty/stats.js");

/**
 * Queue the five per-area result sets, in the order computeFacultyStats
 * issues them: answers, response times, moderation, drafts, complaints.
 */
const queueRows = (
  rows: Partial<Record<"answers" | "responses" | "moderation" | "drafts" | "complaints", unknown[]>>,
) => {
  for (const key of ["answers", "responses", "moderation", "drafts", "complaints"] as const) {
    db.prisma.$queryRaw.mockResolvedValueOnce(rows[key] ?? []);
  }
};

const HOUR = 3600;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseWindow", () => {
  it("accepts the three supported windows", () => {
    expect(parseWindow("30")).toBe(30);
    expect(parseWindow(90)).toBe(90);
    expect(parseWindow("365")).toBe(365);
  });

  /** An arbitrary window is an arbitrary full-table scan. */
  it("falls back to the default for anything else", () => {
    for (const raw of [undefined, "", "7", "100000", "abc", -30]) {
      expect(parseWindow(raw)).toBe(DEFAULT_STATS_WINDOW);
    }
  });
});

describe("median", () => {
  it("ignores nulls and handles even and odd counts", () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("is null when there is nothing to take the median of", () => {
    expect(median([])).toBeNull();
    expect(median([null, null])).toBeNull();
  });
});

describe("computeFacultyStats", () => {
  it("returns zeroed stats, not a missing entry, for someone with no activity", async () => {
    queueRows({});
    const stats = await computeFacultyStats(["u-1"], 90);

    expect(stats.get("u-1")).toMatchObject({
      doubts: { answersPosted: 0, responseTime: { medianHours: null, sampleSize: 0 } },
      complaints: { resolved: 0, sla: { rate: null }, rating: { average: null } },
    });
  });

  it("issues no queries for an empty list", async () => {
    await expect(computeFacultyStats([], 90)).resolves.toEqual(new Map());
    expect(db.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("maps every area onto the right person, in hours", async () => {
    queueRows({
      answers: [{ uid: "u-1", posted: 7, accepted: 2, upvotes: 15 }],
      responses: [{ uid: "u-1", n: 5, median_s: 3 * HOUR, p90_s: 30 * HOUR }],
      moderation: [{ uid: "u-1", n: 4, median_s: 1.5 * HOUR }],
      drafts: [{ uid: "u-1", reviewed: 3, approved: 2, edited: 1 }],
      complaints: [
        {
          uid: "u-1",
          assigned: 6,
          resolved: 5,
          open_now: 1,
          escalated: 1,
          timed: 5,
          median_s: 48 * HOUR,
          sla_tracked: 4,
          sla_met: 3,
          rating_avg: 4.333,
          rating_n: 3,
        },
      ],
    });

    const stats = (await computeFacultyStats(["u-1", "u-2"], 90)).get("u-1")!;

    expect(stats.doubts).toEqual({
      answersPosted: 7,
      doubtsAnswered: 5,
      acceptedAnswers: 2,
      upvotesReceived: 15,
      responseTime: { medianHours: 3, p90Hours: 30, sampleSize: 5 },
    });
    expect(stats.moderation).toEqual({
      answersReviewed: 4,
      reviewTime: { medianHours: 1.5, sampleSize: 4 },
      draftsReviewed: 3,
      draftsApproved: 2,
      draftsEditedOnApproval: 1,
    });
    expect(stats.complaints).toEqual({
      assigned: 6,
      resolved: 5,
      openNow: 1,
      escalated: 1,
      resolutionTime: { medianHours: 48, sampleSize: 5 },
      sla: { tracked: 4, met: 3, rate: 0.75 },
      rating: { average: 4.3, count: 3 },
    });
  });

  /**
   * Two data points are an anecdote. Reporting "median response: 40 hours"
   * off two doubts invites exactly the judgement this feature must not invite.
   */
  it("withholds timings, SLA rate and rating below the minimum sample", async () => {
    queueRows({
      responses: [{ uid: "u-1", n: 2, median_s: 40 * HOUR, p90_s: 50 * HOUR }],
      complaints: [
        {
          uid: "u-1",
          assigned: 2,
          resolved: 2,
          open_now: 0,
          escalated: 0,
          timed: 2,
          median_s: 10 * HOUR,
          sla_tracked: 2,
          sla_met: 0,
          rating_avg: 1,
          rating_n: 2,
        },
      ],
    });

    const stats = (await computeFacultyStats(["u-1"], 90)).get("u-1")!;

    expect(stats.doubts.responseTime).toEqual({
      medianHours: null,
      p90Hours: null,
      sampleSize: 2,
    });
    expect(stats.complaints.resolutionTime.medianHours).toBeNull();
    expect(stats.complaints.sla.rate).toBeNull();
    expect(stats.complaints.rating).toEqual({ average: null, count: 2 });
    // The counts themselves are not sensitive, and stay.
    expect(stats.complaints.resolved).toBe(2);
  });

  it("ignores rows for anyone it was not asked about", async () => {
    queueRows({ answers: [{ uid: "stranger", posted: 99, accepted: 0, upvotes: 0 }] });
    const stats = await computeFacultyStats(["u-1"], 90);

    expect([...stats.keys()]).toEqual(["u-1"]);
    expect(stats.get("u-1")!.doubts.answersPosted).toBe(0);
  });
});

describe("departmentBenchmark", () => {
  /** With two members, the median plus your own number is the other person's. */
  it("publishes nothing for a department smaller than three", async () => {
    db.prisma.user.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);

    await expect(departmentBenchmark("IT", 90)).resolves.toBeNull();
    expect(db.prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("reports medians across members who have data", async () => {
    db.prisma.user.findMany.mockResolvedValueOnce([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    queueRows({
      responses: [
        { uid: "a", n: 3, median_s: 2 * HOUR, p90_s: 2 * HOUR },
        { uid: "b", n: 3, median_s: 6 * HOUR, p90_s: 6 * HOUR },
        // c has no doubts: excluded from the median, not counted as zero.
      ],
    });

    const benchmark = await departmentBenchmark("IT", 90);

    expect(benchmark).toMatchObject({
      department: "IT",
      facultyCount: 3,
      responseTimeMedianHours: 4,
      resolutionTimeMedianHours: null,
    });
  });
});
