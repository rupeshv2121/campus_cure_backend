/**
 * Provider-agnostic AI interfaces.
 *
 * Nothing outside `src/services/ai/` may talk to a provider directly. That
 * boundary is what makes swapping HuggingFace for a self-hosted model later a
 * one-file change rather than a refactor.
 *
 * See docs/adr/0001-ai-provider-strategy.md.
 */

export interface EmbeddingProvider {
  /** Canonical model id, stored alongside every vector it produces. */
  readonly model: string;

  /** Vector length this model emits. Asserted on every response. */
  readonly dimensions: number;

  /**
   * Embed a batch of texts, in order.
   *
   * Batching is a correctness requirement on a free tier, not an
   * optimisation: measured at ~7ms/item for a batch of 50 versus ~572ms for a
   * single item, and per-item calls exhaust the request-rate cap immediately.
   *
   * Throws on a non-retryable failure. Retryable conditions (model loading,
   * rate limiting) are handled internally.
   */
  embed(texts: string[]): Promise<number[][]>;
}

/** Thrown when a provider fails in a way the caller should retry later. */
export class RetryableProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RetryableProviderError";
  }
}

/** Thrown when a response is structurally wrong — never retry these. */
export class ProviderContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderContractError";
  }
}
