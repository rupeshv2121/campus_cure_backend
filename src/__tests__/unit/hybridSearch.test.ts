/**
 * CC-11: degradation behaviour.
 *
 * The governing rule is that no retriever is load-bearing. Vector retrieval
 * depends on a free-tier third party with no uptime guarantee, so these tests
 * assert that search keeps answering when it is slow, rate-limited or absent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchRepo = vi.hoisted(() => ({
  fetchKeywordCandidates: vi.fn(),
  fullTextSearchDoubts: vi.fn(),
  hydrateDoubts: vi.fn(),
}));

const embeddingRepo = vi.hoisted(() => ({
  findSimilarDoubts: vi.fn(),
}));

const providerRef = vi.hoisted(() => ({
  current: null as null | { embed: ReturnType<typeof vi.fn> },
}));

vi.mock("../../repositories/searchRepository.js", () => searchRepo);
vi.mock("../../repositories/embeddingRepository.js", () => embeddingRepo);
vi.mock("../../services/ai/embeddings/index.js", () => ({
  getEmbeddingProvider: () => providerRef.current,
}));

import {
  clearQueryCache,
  hybridSearchDoubts,
} from "../../services/search/hybridSearch.js";

const row = (id: string, title = `Title ${id}`) => ({
  id,
  title,
  description: `Description ${id}`,
  subject: "DSA",
  semester: 3,
  views: 0,
  createdAt: new Date("2026-01-01"),
  _count: { answers: 0 },
});

beforeEach(() => {
  vi.clearAllMocks();
  clearQueryCache();
  providerRef.current = { embed: vi.fn(async () => [[0.1, 0.2, 0.3]]) };
  searchRepo.fetchKeywordCandidates.mockResolvedValue([row("a", "binary search")]);
  searchRepo.fullTextSearchDoubts.mockResolvedValue([{ id: "a", rank: 0.5 }]);
  searchRepo.hydrateDoubts.mockResolvedValue([]);
  embeddingRepo.findSimilarDoubts.mockResolvedValue([{ id: "a", distance: 0.1 }]);
});

describe("hybridSearchDoubts", () => {
  it("uses all three retrievers when everything is healthy", async () => {
    const result = await hybridSearchDoubts("binary search");

    expect(result.used.sort()).toEqual(["fts", "keyword", "vector"]);
    expect(result.degraded).toBe(false);
    expect(result.doubts.map((d) => d.id)).toEqual(["a"]);
  });

  describe("degradation", () => {
    it("still returns results when no embedding provider is configured", async () => {
      providerRef.current = null;

      const result = await hybridSearchDoubts("binary search");

      expect(result.used).not.toContain("vector");
      expect(result.degraded).toBe(true);
      expect(result.doubts).toHaveLength(1);
    });

    it("still returns results when the provider throws", async () => {
      providerRef.current!.embed.mockRejectedValue(new Error("429 rate limited"));

      const result = await hybridSearchDoubts("binary search");

      expect(result.used).not.toContain("vector");
      expect(result.doubts).toHaveLength(1);
    });

    it("still returns results when vector search itself fails", async () => {
      embeddingRepo.findSimilarDoubts.mockRejectedValue(new Error("no index"));

      const result = await hybridSearchDoubts("binary search");

      expect(result.used).toContain("keyword");
      expect(result.doubts).toHaveLength(1);
    });

    it("still returns results when full-text search fails", async () => {
      searchRepo.fullTextSearchDoubts.mockRejectedValue(new Error("bad tsquery"));

      const result = await hybridSearchDoubts("binary search");

      expect(result.used).not.toContain("fts");
      expect(result.doubts).toHaveLength(1);
    });

    it("survives every retriever failing at once", async () => {
      providerRef.current = null;
      searchRepo.fetchKeywordCandidates.mockRejectedValue(new Error("db down"));
      searchRepo.fullTextSearchDoubts.mockRejectedValue(new Error("db down"));

      const result = await hybridSearchDoubts("binary search");

      expect(result.doubts).toEqual([]);
      expect(result.degraded).toBe(true);
    });
  });

  describe("query cache", () => {
    it("embeds once for repeated identical queries", async () => {
      await hybridSearchDoubts("binary search");
      await hybridSearchDoubts("binary search");
      await hybridSearchDoubts("  Binary Search  "); // normalised to the same key

      expect(providerRef.current!.embed).toHaveBeenCalledTimes(1);
    });

    it("embeds again for a different query", async () => {
      await hybridSearchDoubts("binary search");
      await hybridSearchDoubts("hash tables");

      expect(providerRef.current!.embed).toHaveBeenCalledTimes(2);
    });
  });

  describe("filters", () => {
    it("passes subject, semester and excludeId to every retriever", async () => {
      await hybridSearchDoubts("binary search", {
        subject: "DSA",
        semester: 3,
        excludeId: "self",
      });

      const expected = { subject: "DSA", semester: 3, excludeId: "self" };
      expect(searchRepo.fetchKeywordCandidates).toHaveBeenCalledWith(
        "binary search",
        expect.objectContaining(expected),
      );
      expect(searchRepo.fullTextSearchDoubts).toHaveBeenCalledWith(
        "binary search",
        expect.objectContaining(expected),
        expect.any(Number),
      );
      expect(embeddingRepo.findSimilarDoubts).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        expect.objectContaining(expected),
      );
    });
  });

  it("hydrates ids found only by fts or vector", async () => {
    // Keyword found nothing; the hit comes from the other retrievers.
    searchRepo.fetchKeywordCandidates.mockResolvedValue([]);
    searchRepo.fullTextSearchDoubts.mockResolvedValue([{ id: "z", rank: 0.9 }]);
    embeddingRepo.findSimilarDoubts.mockResolvedValue([{ id: "z", distance: 0.2 }]);
    searchRepo.hydrateDoubts.mockResolvedValue([row("z")]);

    const result = await hybridSearchDoubts("something");

    expect(searchRepo.hydrateDoubts).toHaveBeenCalledWith(["z"]);
    expect(result.doubts.map((d) => d.id)).toEqual(["z"]);
  });

  it("honours the limit", async () => {
    const many = ["a", "b", "c", "d"].map((id) => row(id));
    searchRepo.fetchKeywordCandidates.mockResolvedValue(many);
    searchRepo.fullTextSearchDoubts.mockResolvedValue([]);
    embeddingRepo.findSimilarDoubts.mockResolvedValue([]);

    const result = await hybridSearchDoubts("title", { limit: 2 });

    expect(result.doubts.length).toBeLessThanOrEqual(2);
  });
});
