/**
 * CC-20: tag normalization and the vocabulary.
 *
 * The invariant that matters most is that `labels` is never rewritten. Every
 * benefit of normalizing — one filter bucket, one count, one appearance — is
 * derived, so the author's own words survive and the whole thing is
 * reversible.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_TAGS_PER_DOUBT,
  TagError,
  buildVocabulary,
  normalizeTag,
  parseTagQuery,
  prepareTags,
} from "../../utils/tags.js";

describe("normalizeTag", () => {
  it("lowercases and trims", () => {
    expect(normalizeTag("  Recursion ")).toBe("recursion");
  });

  it("collapses internal whitespace to a hyphen", () => {
    expect(normalizeTag("binary   search")).toBe("binary-search");
  });

  it("keeps the characters that make real tags distinct", () => {
    expect(normalizeTag("C++")).toBe("c++");
    expect(normalizeTag("C#")).toBe("c#");
    expect(normalizeTag("Node.js")).toBe("node.js");
  });

  it("does not merge C into C++", () => {
    expect(normalizeTag("c")).not.toBe(normalizeTag("c++"));
  });

  it("strips punctuation that carries no meaning", () => {
    expect(normalizeTag("what?!")).toBe("what");
  });

  it("returns null when nothing usable survives", () => {
    expect(normalizeTag("!!!")).toBeNull();
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag(42)).toBeNull();
    expect(normalizeTag(undefined)).toBeNull();
  });
});

describe("prepareTags", () => {
  it("preserves the author's casing in labels", () => {
    expect(prepareTags(["Recursion", "DP"])).toEqual({
      labels: ["Recursion", "DP"],
      labelsNormalized: ["recursion", "dp"],
    });
  });

  it("deduplicates on the normalized form, first casing winning", () => {
    expect(prepareTags(["Recursion", " recursion ", "RECURSION"])).toEqual({
      labels: ["Recursion"],
      labelsNormalized: ["recursion"],
    });
  });

  it("returns both arrays aligned in length and order", () => {
    const { labels, labelsNormalized } = prepareTags(["Alpha", "Beta", "Gamma"]);

    expect(labels).toHaveLength(labelsNormalized.length);
    labels.forEach((label, index) => {
      expect(normalizeTag(label)).toBe(labelsNormalized[index]);
    });
  });

  it("drops a tag that normalizes to nothing rather than failing", () => {
    expect(prepareTags(["!!!", "DBMS"])).toEqual({
      labels: ["DBMS"],
      labelsNormalized: ["dbms"],
    });
  });

  it("ignores empty strings", () => {
    expect(prepareTags(["", "   ", "os"]).labels).toEqual(["os"]);
  });

  it("treats absent tags as an empty list", () => {
    expect(prepareTags(undefined)).toEqual({ labels: [], labelsNormalized: [] });
    expect(prepareTags(null)).toEqual({ labels: [], labelsNormalized: [] });
  });

  it("rejects a tag over the length limit", () => {
    expect(() => prepareTags(["x".repeat(31)])).toThrow(TagError);
  });

  it("rejects more than the maximum number of tags", () => {
    const tags = Array.from({ length: MAX_TAGS_PER_DOUBT + 1 }, (_, i) => `t${i}`);
    expect(() => prepareTags(tags)).toThrow(/at most/i);
  });

  it("counts toward the maximum only after deduplication", () => {
    // Six entries, five distinct tags.
    expect(() =>
      prepareTags(["a", "A", "b", "c", "d", "e"]),
    ).not.toThrow();
  });

  it("rejects a non-list and non-string entries", () => {
    expect(() => prepareTags("recursion")).toThrow(TagError);
    expect(() => prepareTags([1, 2])).toThrow(TagError);
  });
});

describe("parseTagQuery", () => {
  it("normalizes a single value", () => {
    expect(parseTagQuery("Recursion")).toEqual(["recursion"]);
  });

  it("makes ?tag=Recursion and ?tag=recursion identical", () => {
    expect(parseTagQuery("Recursion")).toEqual(parseTagQuery("recursion"));
  });

  it("accepts the repeated-parameter array Express produces", () => {
    expect(parseTagQuery(["Recursion", "DP"])).toEqual(["recursion", "dp"]);
  });

  it("deduplicates and drops unusable values", () => {
    expect(parseTagQuery(["DP", "dp", "!!!"])).toEqual(["dp"]);
  });

  it("returns an empty list when absent", () => {
    expect(parseTagQuery(undefined)).toEqual([]);
  });
});

describe("buildVocabulary", () => {
  const rows = [
    { labels: ["Recursion"], labelsNormalized: ["recursion"] },
    { labels: ["recursion"], labelsNormalized: ["recursion"] },
    { labels: ["Recursion"], labelsNormalized: ["recursion"] },
    { labels: ["DBMS"], labelsNormalized: ["dbms"] },
  ];

  it("counts every casing variant as one tag", () => {
    const recursion = buildVocabulary(rows).find((t) => t.tag === "recursion");
    expect(recursion?.count).toBe(3);
  });

  it("picks the most common original casing for display", () => {
    const recursion = buildVocabulary(rows).find((t) => t.tag === "recursion");
    expect(recursion?.display).toBe("Recursion");
  });

  it("orders by count, then alphabetically", () => {
    expect(buildVocabulary(rows).map((t) => t.tag)).toEqual([
      "recursion",
      "dbms",
    ]);
  });

  it("includes a tag used exactly once — the response is not capped", () => {
    const vocabulary = buildVocabulary([
      ...rows,
      { labels: ["Verilog"], labelsNormalized: ["verilog"] },
    ]);

    expect(vocabulary.find((t) => t.tag === "verilog")).toEqual({
      tag: "verilog",
      display: "Verilog",
      count: 1,
    });
  });

  it("falls back to the normalized form for a legacy unaligned row", () => {
    const vocabulary = buildVocabulary([
      { labels: [], labelsNormalized: ["os"] },
    ]);

    expect(vocabulary[0]).toEqual({ tag: "os", display: "os", count: 1 });
  });

  it("is empty for no rows", () => {
    expect(buildVocabulary([])).toEqual([]);
  });
});
