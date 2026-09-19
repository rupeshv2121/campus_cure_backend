/**
 * Reciprocal Rank Fusion.
 *
 * Combines ranked lists from retrievers whose scores are not comparable: a
 * cosine distance, a `ts_rank` float and an ad-hoc 6/3/3/1 keyword integer
 * cannot be averaged in any meaningful way. RRF discards magnitudes and uses
 * ordinal position only, so no normalisation is needed and a retriever that
 * emits wild values cannot dominate the result.
 *
 *     score(d) = Σ  1 / (k + rank_i(d))
 *
 * See docs/specs/CC-11-hybrid-search.md.
 */

/** Literature default. Damps the difference between the top few ranks. */
export const DEFAULT_RRF_K = 60;

export interface RetrieverResult {
  /** Retriever name, retained so results can be explained and debugged. */
  source: string;
  /** Document ids, best first. Position is what matters; scores are ignored. */
  ids: string[];
}

export interface FusedResult {
  id: string;
  score: number;
  /** Which retrievers found this document, and at what 1-based rank. */
  sources: Record<string, number>;
}

/**
 * Per-retriever weights.
 *
 * Equal weighting assumes every retriever is comparably good. Measured on the
 * CC-11 corpus that is false — full-text scored 38.5% Recall@5 against vector's
 * 100%, and equal-weight fusion therefore scored WORSE than vector alone
 * (92.3%). Weighting restores the stronger signal's influence while keeping the
 * weaker retrievers available for the queries they win.
 *
 * These numbers come from the evaluation harness, not intuition. Re-measure
 * before changing them: `npx tsx src/scripts/evalRetrieval.ts`.
 */
export const DEFAULT_WEIGHTS: Record<string, number> = {
  vector: 3,
  keyword: 2,
  fts: 1,
};

/**
 * Fuse ranked lists. Documents found by several retrievers accumulate score,
 * which is what makes a hybrid stronger than any single retriever: agreement
 * between independent signals is evidence.
 */
export const reciprocalRankFusion = (
  results: RetrieverResult[],
  options: {
    k?: number;
    limit?: number;
    weights?: Record<string, number>;
  } = {},
): FusedResult[] => {
  const k = options.k ?? DEFAULT_RRF_K;
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const fused = new Map<string, FusedResult>();

  for (const { source, ids } of results) {
    const weight = weights[source] ?? 1;

    ids.forEach((id, index) => {
      const rank = index + 1; // 1-based: rank 0 would over-weight the top hit
      const contribution = weight / (k + rank);
      const existing = fused.get(id);

      if (existing) {
        existing.score += contribution;
        existing.sources[source] = rank;
      } else {
        fused.set(id, {
          id,
          score: contribution,
          sources: { [source]: rank },
        });
      }
    });
  }

  const ordered = [...fused.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Deterministic tie-break, so equal scores do not reorder between calls.
    return a.id.localeCompare(b.id);
  });

  return options.limit ? ordered.slice(0, options.limit) : ordered;
};
