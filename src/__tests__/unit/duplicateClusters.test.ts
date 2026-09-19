/**
 * CC-13: duplicate complaint clustering (admin view).
 *
 * The behaviour that matters is transitivity. Pairwise results are not enough
 * for triage: if A~B and B~C, an admin must see one group of three rather than
 * two overlapping pairs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ findDuplicateComplaintPairs: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: { complaint: { findMany: vi.fn() } },
}));

vi.mock("../../repositories/embeddingRepository.js", () => repo);
vi.mock("../../config/database.js", () => db);
vi.mock("../../config/env.js", () => ({
  DUPLICATE_SIMILARITY_THRESHOLD: 0.52,
}));

import { getDuplicateClusters } from "../../services/search/duplicateClusters.js";

const complaint = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  title: `Complaint ${id}`,
  status: "RAISED",
  category: "FAN",
  block: "ML",
  classroomNumber: "ML02",
  createdAt: new Date(`2026-09-0${id.replace(/\D/g, "") || 1}`),
  raisedBy: { name: `Student ${id}` },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.complaint.findMany.mockResolvedValue([]);
});

describe("getDuplicateClusters", () => {
  it("returns nothing when there are no candidate pairs", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([]);
    await expect(getDuplicateClusters()).resolves.toEqual([]);
    // No point querying complaints if nothing paired.
    expect(db.prisma.complaint.findMany).not.toHaveBeenCalled();
  });

  it("converts the similarity threshold into a distance ceiling", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([]);
    await getDuplicateClusters();
    expect(repo.findDuplicateComplaintPairs).toHaveBeenCalledWith(
      expect.closeTo(0.48, 10),
    );
  });

  it("groups a simple pair into one cluster of two", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([
      { aId: "c1", bId: "c2", similarity: 0.8 },
    ]);
    db.prisma.complaint.findMany.mockResolvedValue([
      complaint("c1"),
      complaint("c2"),
    ]);

    const clusters = await getDuplicateClusters();

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.size).toBe(2);
    expect(clusters[0]!.topSimilarity).toBe(0.8);
  });

  /** The reason clustering exists rather than just returning pairs. */
  it("merges transitively: A~B and B~C become one cluster of three", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([
      { aId: "c1", bId: "c2", similarity: 0.7 },
      { aId: "c2", bId: "c3", similarity: 0.75 },
    ]);
    db.prisma.complaint.findMany.mockResolvedValue([
      complaint("c1"),
      complaint("c2"),
      complaint("c3"),
    ]);

    const clusters = await getDuplicateClusters();

    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.size).toBe(3);
    expect(clusters[0]!.complaints.map((c) => c.id).sort()).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
    // Highest similarity within the group, not the first one seen.
    expect(clusters[0]!.topSimilarity).toBe(0.75);
  });

  it("keeps unrelated groups separate", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([
      { aId: "c1", bId: "c2", similarity: 0.7 },
      { aId: "c8", bId: "c9", similarity: 0.9 },
    ]);
    db.prisma.complaint.findMany.mockResolvedValue([
      complaint("c1"),
      complaint("c2"),
      complaint("c8", { block: "NL", classroomNumber: "NL28" }),
      complaint("c9", { block: "NL", classroomNumber: "NL28" }),
    ]);

    const clusters = await getDuplicateClusters();

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.size)).toEqual([2, 2]);
  });

  it("orders complaints oldest first, so the original is obvious", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([
      { aId: "c1", bId: "c2", similarity: 0.8 },
    ]);
    db.prisma.complaint.findMany.mockResolvedValue([
      complaint("c1", { createdAt: new Date("2026-09-09") }),
      complaint("c2", { createdAt: new Date("2026-09-02") }),
    ]);

    const clusters = await getDuplicateClusters();

    expect(clusters[0]!.complaints.map((c) => c.id)).toEqual(["c2", "c1"]);
  });

  it("puts the largest cluster first", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([
      { aId: "c1", bId: "c2", similarity: 0.95 },
      { aId: "c5", bId: "c6", similarity: 0.6 },
      { aId: "c6", bId: "c7", similarity: 0.6 },
    ]);
    db.prisma.complaint.findMany.mockResolvedValue(
      ["c1", "c2", "c5", "c6", "c7"].map((id) => complaint(id)),
    );

    const clusters = await getDuplicateClusters();

    expect(clusters[0]!.size).toBe(3);
    expect(clusters[1]!.size).toBe(2);
  });

  it("drops a group whose members no longer exist", async () => {
    repo.findDuplicateComplaintPairs.mockResolvedValue([
      { aId: "gone1", bId: "gone2", similarity: 0.9 },
    ]);
    db.prisma.complaint.findMany.mockResolvedValue([]); // both deleted

    await expect(getDuplicateClusters()).resolves.toEqual([]);
  });

  it("returns an empty list rather than throwing when the query fails", async () => {
    repo.findDuplicateComplaintPairs.mockRejectedValue(new Error("no index"));
    await expect(getDuplicateClusters()).resolves.toEqual([]);
  });
});
