/**
 * Hybrid doubt search: keyword + full-text + vector, fused with RRF.
 *
 * The governing rule is that no retriever is load-bearing. Vector retrieval
 * needs a network call to an external provider on a free tier; if it is slow,
 * rate-limited or down, search degrades to keyword + full-text rather than
 * failing. A student looking for duplicates must always get an answer.
 *
 * See docs/specs/CC-11-hybrid-search.md.
 */
import {
  fetchKeywordCandidates,
  fullTextSearchDoubts,
  hydrateDoubts,
  type DoubtCandidate,
  type SearchFilters,
} from "../../repositories/searchRepository.js";
import { findSimilarDoubts } from "../../repositories/embeddingRepository.js";
import { getEmbeddingProvider } from "../ai/embeddings/index.js";
import { keywordRank, scoreByKeyword } from "./keywordRetriever.js";
import { reciprocalRankFusion, type RetrieverResult } from "./rrf.js";

export interface HybridSearchOptions extends SearchFilters {
  limit?: number;
  /** Escape hatch for the evaluation harness. */
  retrievers?: Array<"keyword" | "fts" | "vector">;
}

export interface HybridSearchResult {
  doubts: Array<DoubtCandidate & { matchedKeywords: string[] }>;
  /** Which retrievers actually contributed — surfaced for debugging and eval. */
  used: string[];
  degraded: boolean;
}

/**
 * Query embeddings are cached briefly because this endpoint fires as a student
 * types. Without it, one search costs a dozen provider calls against a free
 * tier quota.
 */
const QUERY_CACHE_TTL_MS = 60_000;
const QUERY_CACHE_MAX = 200;
const queryCache = new Map<string, { vector: number[]; at: number }>();

const cacheKey = (query: string) => query.trim().toLowerCase();

const getCachedVector = (query: string): number[] | undefined => {
  const hit = queryCache.get(cacheKey(query));
  if (!hit) return undefined;
  if (Date.now() - hit.at > QUERY_CACHE_TTL_MS) {
    queryCache.delete(cacheKey(query));
    return undefined;
  }
  return hit.vector;
};

const setCachedVector = (query: string, vector: number[]): void => {
  // Crude bound: this is a per-instance cache on a serverless function, not a
  // shared store. Evicting the oldest entry is sufficient.
  if (queryCache.size >= QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(cacheKey(query), { vector, at: Date.now() });
};

/** Test seam. */
export const clearQueryCache = (): void => queryCache.clear();

/**
 * Embed the query, or return null if that is not possible right now.
 * Never throws — an embedding failure degrades search, it does not break it.
 */
const embedQuery = async (query: string): Promise<number[] | null> => {
  const cached = getCachedVector(query);
  if (cached) return cached;

  const provider = getEmbeddingProvider();
  if (!provider) return null;

  try {
    const [vector] = await provider.embed([query]);
    if (!vector) return null;
    setCachedVector(query, vector);
    return vector;
  } catch (error) {
    console.error("[search] query embedding failed:", (error as Error).message);
    return null;
  }
};

/** Run a retriever, logging and swallowing failure so fusion continues. */
const safely = async (
  name: string,
  run: () => Promise<string[]>,
): Promise<RetrieverResult | null> => {
  try {
    return { source: name, ids: await run() };
  } catch (error) {
    console.error(`[search] retriever "${name}" failed:`, (error as Error).message);
    return null;
  }
};

export const hybridSearchDoubts = async (
  query: string,
  options: HybridSearchOptions = {},
): Promise<HybridSearchResult> => {
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);
  const enabled = new Set(options.retrievers ?? ["keyword", "fts", "vector"]);
  const filters: SearchFilters = {
    subject: options.subject,
    semester: options.semester,
    excludeId: options.excludeId,
  };

  // Fetched once and reused: the keyword retriever ranks them, and the
  // matchedKeywords they produce are part of the response contract.
  const candidates = enabled.has("keyword")
    ? await fetchKeywordCandidates(query, filters).catch((error) => {
        console.error("[search] candidate fetch failed:", error.message);
        return [] as DoubtCandidate[];
      })
    : [];

  const vector = enabled.has("vector") ? await embedQuery(query) : null;

  const results = (
    await Promise.all([
      enabled.has("keyword")
        ? safely("keyword", async () => keywordRank(query, candidates))
        : null,
      enabled.has("fts")
        ? safely("fts", async () =>
            (await fullTextSearchDoubts(query, filters, 20)).map((r) => r.id),
          )
        : null,
      vector
        ? safely("vector", async () =>
            (
              await findSimilarDoubts(vector, { ...filters, limit: 20 })
            ).map((r) => r.id),
          )
        : null,
    ])
  ).filter((result): result is RetrieverResult => result !== null);

  const fused = reciprocalRankFusion(results, { limit });

  // Rows already fetched for the keyword pass are reused; only ids that came
  // solely from fts/vector need a second query.
  const known = new Map(candidates.map((c) => [c.id, c]));
  const missing = fused.map((f) => f.id).filter((id) => !known.has(id));
  for (const row of await hydrateDoubts(missing)) known.set(row.id, row);

  const keywordMeta = new Map(
    scoreByKeyword(query, candidates).map((c) => [c.id, c.matchedKeywords]),
  );

  const doubts = fused
    .map((f) => {
      const row = known.get(f.id);
      if (!row) return null;
      return { ...row, matchedKeywords: keywordMeta.get(f.id) ?? [] };
    })
    .filter((row): row is DoubtCandidate & { matchedKeywords: string[] } =>
      Boolean(row),
    );

  const used = results.map((r) => r.source);

  return {
    doubts,
    used,
    // Degraded when a retriever we intended to run did not contribute.
    degraded: used.length < enabled.size,
  };
};
