/**
 * CC-27: who should fix this?
 *
 * The bug being fixed is specific and worth restating, because every
 * assertion here is a guard against a version of it: the deleted rules table
 * routed a broken fan to a *teaching lecturer in Electrical Engineering*, and
 * `FacultyProfile.isTeaching` — which would have caught that — existed, was
 * settable, and was read by nothing.
 *
 * So the load-bearing property is not "the ranking is clever". It is:
 *
 *   an electrician who declares FAN must outrank every lecturer,
 *   whatever their department and however busy they are.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    user: { findMany: vi.fn() },
    complaint: { groupBy: vi.fn() },
  },
}));

vi.mock("../../config/database.js", () => db);

import {
  ROUTABLE_CATEGORIES,
  isRoutableCategory,
  listDirectory,
  rankCandidates,
} from "../../services/staff/routing.js";

interface StaffSpec {
  id: string;
  name: string;
  department?: string;
  isTeaching?: boolean;
  staffRole?: string | null;
  handlesCategories?: string[];
  directoryOptIn?: boolean;
  phoneNumber?: string;
  subjects?: string[];
}

const staff = (spec: StaffSpec) => ({
  id: spec.id,
  name: spec.name,
  email: `${spec.id}@campus.test`,
  facultyProfile: {
    department: spec.department ?? "General",
    isTeaching: spec.isTeaching ?? true,
    staffRole: spec.staffRole ?? null,
    handlesCategories: spec.handlesCategories ?? [],
    subjects: spec.subjects ?? [],
    phoneNumber: spec.phoneNumber ?? "9876543210",
  },
});

const ELECTRICIAN = staff({
  id: "elec",
  name: "Zara Electrician",
  department: "Maintenance",
  isTeaching: false,
  staffRole: "Electrician",
  handlesCategories: ["FAN", "LIGHT"],
});

const LECTURER = staff({
  id: "lect",
  name: "Aaron Lecturer",
  department: "Electrical Engineering",
  isTeaching: true,
  subjects: ["Circuits"],
});

const CLEANER = staff({
  id: "clean",
  name: "Mo Cleaner",
  department: "Housekeeping",
  isTeaching: false,
  staffRole: "Housekeeping",
});

const setStaff = (rows: unknown[]) => db.prisma.user.findMany.mockResolvedValue(rows);
const setLoads = (rows: Array<{ assignedToId: string; count: number }>) =>
  db.prisma.complaint.groupBy.mockResolvedValue(
    rows.map((row) => ({ assignedToId: row.assignedToId, _count: { _all: row.count } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  setLoads([]);
});

describe("isRoutableCategory", () => {
  it.each(ROUTABLE_CATEGORIES)("accepts %s", (category) => {
    expect(isRoutableCategory(category)).toBe(true);
  });

  it.each(["fan", "PLUMBING", "", null, undefined, 42, {}])(
    "rejects %s",
    (value) => {
      expect(isRoutableCategory(value)).toBe(false);
    },
  );
});

describe("rankCandidates — the fan bug", () => {
  /**
   * THE test. Lecturer is alphabetically first, in the department the old
   * rules table would have chosen, and has zero open complaints. The
   * electrician is last alphabetically, in a different department, and busy.
   * The electrician must still win, because they are the one who fixes fans.
   */
  it("ranks the electrician above the Electrical Engineering lecturer", async () => {
    setStaff([LECTURER, ELECTRICIAN]);
    setLoads([{ assignedToId: "elec", count: 7 }]);

    const [first] = await rankCandidates({ category: "FAN" });

    expect(first!.id).toBe("elec");
    expect(first!.reason).toBe("handles-category");
  });

  it("puts a lecturer last, even when nobody declared the category", async () => {
    setStaff([LECTURER, CLEANER]);

    const ranked = await rankCandidates({ category: "FAN" });

    // Non-teaching staff are a better guess than a lecturer even without a
    // declaration: they are maintenance staff whose list may be incomplete.
    expect(ranked.map((c) => c.id)).toEqual(["clean", "lect"]);
    expect(ranked[1]!.reason).toBe("teaching-fallback");
  });

  it("prefers the declaring staff member in the same department", async () => {
    const other = staff({
      id: "elec2",
      name: "Another Electrician",
      department: "Maintenance",
      isTeaching: false,
      handlesCategories: ["FAN"],
    });
    const offsite = staff({
      id: "elec3",
      name: "Offsite Electrician",
      department: "Annexe",
      isTeaching: false,
      handlesCategories: ["FAN"],
    });
    setStaff([offsite, other]);

    const ranked = await rankCandidates({
      category: "FAN",
      department: "Maintenance",
    });

    expect(ranked[0]!.id).toBe("elec2");
    expect(ranked[0]!.reason).toBe("handles-category-same-department");
  });

  /**
   * Load spreads work WITHIN a band, never across one. If load could cross
   * bands, an idle lecturer would outrank a busy electrician and we would be
   * back to the original bug by a different route.
   */
  it("uses open load only as a tiebreak inside a band", async () => {
    const busy = staff({
      id: "busy",
      name: "A Busy",
      isTeaching: false,
      handlesCategories: ["FAN"],
    });
    const free = staff({
      id: "free",
      name: "Z Free",
      isTeaching: false,
      handlesCategories: ["FAN"],
    });
    setStaff([busy, free]);
    setLoads([{ assignedToId: "busy", count: 9 }]);

    const ranked = await rankCandidates({ category: "FAN" });

    // Same band, so the idle one wins despite being alphabetically last.
    expect(ranked.map((c) => c.id)).toEqual(["free", "busy"]);
  });

  it("falls back to name order when band and load tie", async () => {
    const a = staff({ id: "a", name: "Aaa", isTeaching: false });
    const z = staff({ id: "z", name: "Zzz", isTeaching: false });
    setStaff([z, a]);

    expect((await rankCandidates({ category: "FAN" })).map((c) => c.id)).toEqual([
      "a",
      "z",
    ]);
  });

  /**
   * Ranking is advice. Hiding people would turn one wrong
   * `handlesCategories` value into a complaint nobody can be assigned to.
   */
  it("returns everyone assignable, never a filtered list", async () => {
    setStaff([LECTURER, ELECTRICIAN, CLEANER]);
    expect(await rankCandidates({ category: "FAN" })).toHaveLength(3);
  });

  it("ranks on role alone for an unknown or missing category", async () => {
    setStaff([LECTURER, CLEANER]);

    for (const category of [null, "PLUMBING", ""]) {
      const ranked = await rankCandidates({ category });
      expect(ranked[0]!.id).toBe("clean");
    }
  });

  it("counts load in one grouped query, not one per candidate", async () => {
    setStaff([LECTURER, ELECTRICIAN, CLEANER]);
    await rankCandidates({ category: "FAN" });

    expect(db.prisma.complaint.groupBy).toHaveBeenCalledTimes(1);
  });

  it("handles an empty staff list without querying for load", async () => {
    setStaff([]);
    expect(await rankCandidates({ category: "FAN" })).toEqual([]);
    expect(db.prisma.complaint.groupBy).not.toHaveBeenCalled();
  });

  it("honours a limit", async () => {
    setStaff([LECTURER, ELECTRICIAN, CLEANER]);
    expect(await rankCandidates({ category: "FAN", limit: 2 })).toHaveLength(2);
  });
});

describe("listDirectory — consent", () => {
  /**
   * The roadmap cut a student directory as a harassment vector. What makes a
   * staff directory different is consent, so the opt-in filter is the whole
   * justification for the feature existing — not a preference toggle.
   */
  it("queries only opted-in profiles", async () => {
    setStaff([]);
    await listDirectory({});

    const where = db.prisma.user.findMany.mock.calls[0]![0].where;
    expect(where.facultyProfile.directoryOptIn).toBe(true);
  });

  it("never returns the home address", async () => {
    setStaff([ELECTRICIAN]);
    const [entry] = await listDirectory({});

    expect(entry).not.toHaveProperty("address");
    // Nor is it selected, so it never leaves the database.
    const select = db.prisma.user.findMany.mock.calls[0]![0].select;
    expect(select.facultyProfile.select).not.toHaveProperty("address");
  });

  /**
   * "Not Set" is the placeholder registration writes. Returned verbatim it
   * would have students dialling a string.
   */
  it("reports an unset phone number as null", async () => {
    setStaff([staff({ id: "x", name: "X", phoneNumber: "Not Set" })]);
    expect((await listDirectory({}))[0]!.phoneNumber).toBeNull();
  });

  it("filters by category when asked", async () => {
    setStaff([]);
    await listDirectory({ category: "FAN" });

    const where = db.prisma.user.findMany.mock.calls[0]![0].where;
    expect(where.facultyProfile.handlesCategories).toEqual({ has: "FAN" });
  });

  it("ignores an unknown category rather than returning nothing", async () => {
    setStaff([]);
    await listDirectory({ category: "PLUMBING" });

    const where = db.prisma.user.findMany.mock.calls[0]![0].where;
    expect(where.facultyProfile).not.toHaveProperty("handlesCategories");
  });

  it.each([
    [true, true],
    [false, false],
    [null, undefined],
  ])("teaching filter %s", async (input, expected) => {
    setStaff([]);
    await listDirectory({ teaching: input });

    const where = db.prisma.user.findMany.mock.calls[0]![0].where;
    expect(where.facultyProfile.isTeaching).toBe(expected);
  });
});
