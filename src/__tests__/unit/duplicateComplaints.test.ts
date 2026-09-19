/**
 * CC-13: duplicate complaint detection.
 *
 * The rules that matter most are the ones that stop this feature doing harm:
 * it must never block a complaint being filed, and it must never claim a
 * duplicate it cannot justify.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findSimilarComplaints: vi.fn(),
  buildEmbeddingText: (d: { title: string; description: string }) =>
    `${d.title}\n${d.description}`,
}));

const providerRef = vi.hoisted(() => ({
  current: null as null | { embed: ReturnType<typeof vi.fn> },
}));

vi.mock("../../repositories/embeddingRepository.js", () => repo);
vi.mock("../../services/ai/embeddings/index.js", () => ({
  getEmbeddingProvider: () => providerRef.current,
}));
vi.mock("../../config/env.js", () => ({
  DUPLICATE_SIMILARITY_THRESHOLD: 0.52,
}));

import { findDuplicateComplaints } from "../../services/search/duplicateComplaints.js";

const input = {
  title: "Projector not working",
  description: "Will not turn on",
  block: "ML",
  classroomNumber: "ML02",
};

const match = (id: string, distance: number) => ({
  id,
  distance,
  title: `Complaint ${id}`,
  status: "RAISED",
  createdAt: new Date("2026-09-01"),
});

beforeEach(() => {
  vi.clearAllMocks();
  providerRef.current = { embed: vi.fn(async () => [[0.1, 0.2, 0.3]]) };
  repo.findSimilarComplaints.mockResolvedValue([match("c1", 0.2)]);
});

describe("findDuplicateComplaints", () => {
  it("returns candidates with similarity rather than raw distance", async () => {
    const result = await findDuplicateComplaints(input);

    expect(result).toEqual([
      expect.objectContaining({ id: "c1", similarity: 0.8, status: "RAISED" }),
    ]);
  });

  it("scopes the query to the exact room", async () => {
    await findDuplicateComplaints(input);

    expect(repo.findSimilarComplaints).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      expect.objectContaining({ block: "ML", classroomNumber: "ML02" }),
    );
  });

  it("converts the similarity threshold into a distance ceiling", async () => {
    await findDuplicateComplaints(input);

    // 0.52 similarity == 0.48 cosine distance. Passing the similarity straight
    // through would invert the filter and return only the WORST matches.
    expect(repo.findSimilarComplaints).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxDistance: expect.closeTo(0.48, 10) }),
    );
  });

  it("passes excludeId through so a complaint is not its own duplicate", async () => {
    await findDuplicateComplaints({ ...input, excludeId: "self" });

    expect(repo.findSimilarComplaints).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ excludeId: "self" }),
    );
  });

  describe("never blocks filing a complaint", () => {
    it("returns empty when no provider is configured", async () => {
      providerRef.current = null;
      await expect(findDuplicateComplaints(input)).resolves.toEqual([]);
    });

    it("returns empty when embedding throws", async () => {
      providerRef.current!.embed.mockRejectedValue(new Error("429"));
      await expect(findDuplicateComplaints(input)).resolves.toEqual([]);
    });

    it("returns empty when the similarity query throws", async () => {
      repo.findSimilarComplaints.mockRejectedValue(new Error("no index"));
      await expect(findDuplicateComplaints(input)).resolves.toEqual([]);
    });

    it("never rejects, whatever fails", async () => {
      providerRef.current!.embed.mockRejectedValue(new Error("boom"));
      repo.findSimilarComplaints.mockRejectedValue(new Error("boom"));
      await expect(findDuplicateComplaints(input)).resolves.toBeInstanceOf(Array);
    });
  });

  describe("location is required", () => {
    it.each([
      ["missing block", { block: "" }],
      ["missing room", { classroomNumber: "" }],
      ["whitespace block", { block: "   " }],
    ])("returns empty and does not embed when %s", async (_label, override) => {
      const result = await findDuplicateComplaints({ ...input, ...override });

      expect(result).toEqual([]);
      // Also saves a provider call, which matters on a free tier.
      expect(providerRef.current!.embed).not.toHaveBeenCalled();
      expect(repo.findSimilarComplaints).not.toHaveBeenCalled();
    });
  });

  it("returns an empty list rather than inventing a candidate when none match", async () => {
    repo.findSimilarComplaints.mockResolvedValue([]);
    await expect(findDuplicateComplaints(input)).resolves.toEqual([]);
  });
});
