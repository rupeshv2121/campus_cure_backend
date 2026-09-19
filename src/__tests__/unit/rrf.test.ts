/**
 * CC-11: Reciprocal Rank Fusion and the keyword baseline.
 *
 * The keyword tests are parity tests: that scorer is the measured baseline for
 * the whole spec, so its behaviour must not drift.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RRF_K,
  DEFAULT_WEIGHTS,
  reciprocalRankFusion,
} from "../../services/search/rrf.js";
import {
  extractKeywords,
  normalizeForKeywordMatch,
  scoreByKeyword,
} from "../../services/search/keywordRetriever.js";

describe("reciprocalRankFusion", () => {
  it("returns an empty list when no retriever found anything", () => {
    expect(reciprocalRankFusion([{ source: "a", ids: [] }])).toEqual([]);
  });

  it("preserves order for a single retriever", () => {
    const fused = reciprocalRankFusion([{ source: "a", ids: ["x", "y", "z"] }], {
      weights: { a: 1 },
    });
    expect(fused.map((f) => f.id)).toEqual(["x", "y", "z"]);
  });

  it("scores rank 1 as weight/(k+1)", () => {
    const [top] = reciprocalRankFusion([{ source: "a", ids: ["x"] }], {
      weights: { a: 1 },
    });
    expect(top!.score).toBeCloseTo(1 / (DEFAULT_RRF_K + 1), 10);
  });

  it("promotes a document that several retrievers agree on", () => {
    // "b" is never first, but is found by all three.
    const fused = reciprocalRankFusion(
      [
        { source: "one", ids: ["a", "b"] },
        { source: "two", ids: ["c", "b"] },
        { source: "three", ids: ["d", "b"] },
      ],
      { weights: { one: 1, two: 1, three: 1 } },
    );
    expect(fused[0]!.id).toBe("b");
  });

  it("records which retrievers found each document, and at what rank", () => {
    const fused = reciprocalRankFusion([
      { source: "keyword", ids: ["a", "b"] },
      { source: "vector", ids: ["b"] },
    ]);
    const b = fused.find((f) => f.id === "b")!;
    expect(b.sources).toEqual({ keyword: 2, vector: 1 });
  });

  it("weights a stronger retriever above a weaker one", () => {
    // Equal weights would tie these; vector's weight must break it.
    const fused = reciprocalRankFusion(
      [
        { source: "fts", ids: ["weak"] },
        { source: "vector", ids: ["strong"] },
      ],
      { weights: DEFAULT_WEIGHTS },
    );
    expect(fused[0]!.id).toBe("strong");
  });

  it("lets one high-weight retriever outrank a low-weight one further up", () => {
    const fused = reciprocalRankFusion(
      [
        { source: "fts", ids: ["a", "b"] },
        { source: "vector", ids: ["b"] },
      ],
      { weights: { fts: 1, vector: 3 } },
    );
    expect(fused[0]!.id).toBe("b");
  });

  it("respects the limit", () => {
    const fused = reciprocalRankFusion([{ source: "a", ids: ["1", "2", "3"] }], {
      limit: 2,
    });
    expect(fused).toHaveLength(2);
  });

  it("is deterministic when scores tie", () => {
    const lists = [
      { source: "a", ids: ["zebra"] },
      { source: "b", ids: ["apple"] },
    ];
    const first = reciprocalRankFusion(lists, { weights: { a: 1, b: 1 } });
    const second = reciprocalRankFusion(lists, { weights: { a: 1, b: 1 } });
    expect(first.map((f) => f.id)).toEqual(second.map((f) => f.id));
  });

  it("treats an unknown source as weight 1 rather than dropping it", () => {
    const fused = reciprocalRankFusion([{ source: "mystery", ids: ["x"] }]);
    expect(fused[0]!.score).toBeCloseTo(1 / (DEFAULT_RRF_K + 1), 10);
  });
});

describe("keyword baseline (parity — must not drift)", () => {
  const docs = [
    { id: "a", title: "Explain binary search", description: "sorted array" },
    { id: "b", title: "Quicksort complexity", description: "worst case" },
  ];

  it("normalises punctuation and case", () => {
    expect(normalizeForKeywordMatch("How  does BINARY-search work?")).toBe(
      "how does binary search work",
    );
  });

  it("drops stop words and short tokens", () => {
    expect(extractKeywords("what is the binary search")).toEqual([
      "binary",
      "search",
    ]);
  });

  it("scores an exact title match highest", () => {
    const [top] = scoreByKeyword("Explain binary search", docs);
    expect(top!.id).toBe("a");
    // 6 for the exact title, plus 3 each for 'explain', 'binary', 'search'
    expect(top!.score).toBe(15);
  });

  it("excludes documents with no match at all", () => {
    expect(scoreByKeyword("photosynthesis", docs)).toEqual([]);
  });

  /**
   * The motivating failure for the whole spec: the keyword baseline cannot
   * connect these two phrasings. If this ever starts passing, the baseline has
   * changed and the CC-11 comparison is no longer valid.
   */
  it("still cannot match a paraphrase — this is why CC-11 exists", () => {
    const results = scoreByKeyword("How does binary search work?", docs);
    const exact = scoreByKeyword("Explain binary search", docs);
    expect(exact[0]!.score).toBeGreaterThan(results[0]?.score ?? 0);
  });
});
