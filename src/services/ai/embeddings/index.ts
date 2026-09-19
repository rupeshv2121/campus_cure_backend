/**
 * Embedding provider selection.
 *
 * There is deliberately **no fallback provider**. Vectors from different models
 * occupy different spaces — MiniLM emits 384 dimensions, `mistral-embed` emits
 * 1024 — so substituting a provider on failure would silently poison the index:
 * writes succeed, queries return rows, and the results are meaningless.
 *
 * Failure is handled by the retry queue instead. See
 * docs/adr/0001-ai-provider-strategy.md.
 */
import {
  AI_ENABLED,
  EMBEDDING_DIMENSIONS,
  HF_API_TOKEN,
  HF_EMBEDDING_MODEL,
} from "../../../config/env.js";
import type { EmbeddingProvider } from "../types.js";
import { HuggingFaceEmbeddingProvider } from "./huggingface.js";

let cached: EmbeddingProvider | null = null;

/**
 * The configured provider, or `null` when AI is disabled or unconfigured.
 *
 * Callers must treat `null` as a normal state, not an error — it is what lets
 * the application run with no AI credentials at all.
 */
export const getEmbeddingProvider = (): EmbeddingProvider | null => {
  if (!AI_ENABLED || !HF_API_TOKEN) return null;

  cached ??= new HuggingFaceEmbeddingProvider({
    token: HF_API_TOKEN,
    model: HF_EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return cached;
};

/** Test seam: drop the memoised instance. */
export const resetEmbeddingProvider = (): void => {
  cached = null;
};
