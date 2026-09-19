/**
 * HuggingFace Inference embedding provider.
 *
 * Verified against the live API on 2026-09-19:
 *
 *   POST https://router.huggingface.co/hf-inference/models/<model>/pipeline/feature-extraction
 *   Authorization: Bearer <token>
 *   Body:     { "inputs": ["text one", "text two"] }
 *   Response: number[][] — one already-pooled vector per input
 *
 * Two things that cost time to discover, recorded so nobody repeats them:
 *
 *  - The legacy `api-inference.huggingface.co` host is dead (DNS failure).
 *  - A plain "Read" token is rejected with 403. The token needs the global
 *    "Make calls to Inference Providers" permission. `whoami-v2` may still
 *    report `global: []` even when calls succeed, so trust a real call.
 */
import {
  ProviderContractError,
  RetryableProviderError,
  type EmbeddingProvider,
} from "../types.js";

const ROUTER_BASE = "https://router.huggingface.co/hf-inference/models";

/** HF returns no rate-limit headers, so 429 must be handled reactively. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface HuggingFaceProviderOptions {
  token: string;
  model: string;
  dimensions: number;
  /** Total attempts per call, including the first. */
  maxAttempts?: number;
  /** Per-request timeout. A hung provider must not hold a lambda open. */
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests, so backoff does not make the suite slow. */
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;

  private readonly token: string;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: HuggingFaceProviderOptions) {
    this.token = options.token;
    this.model = options.model;
    this.dimensions = options.dimensions;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleepImpl ?? defaultSleep;
  }

  private get endpoint(): string {
    return `${ROUTER_BASE}/${this.model}/pipeline/feature-extraction`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.attempt(texts);
      } catch (error) {
        if (error instanceof ProviderContractError) throw error; // never retry
        lastError = error as Error;

        if (attempt < this.maxAttempts) {
          // 1s, 2s, 4s — covers both a cold model waking up and a brief 429.
          await this.sleep(2 ** (attempt - 1) * 1000);
        }
      }
    }

    throw lastError ?? new Error("Embedding failed for an unknown reason");
  }

  private async attempt(texts: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: texts }),
        signal: controller.signal,
      });
    } catch (error) {
      // Network failure or timeout — both are worth retrying.
      throw new RetryableProviderError(
        `HuggingFace request failed: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");

      if (RETRYABLE_STATUSES.has(response.status)) {
        throw new RetryableProviderError(
          `HuggingFace returned ${response.status}: ${body.slice(0, 200)}`,
          response.status,
        );
      }

      // 401/403 mean the token is wrong or lacks inference permission.
      // Retrying cannot fix that, so fail loudly with an actionable message.
      throw new ProviderContractError(
        `HuggingFace returned ${response.status}: ${body.slice(0, 200)}` +
          (response.status === 403
            ? ' — the token likely lacks the global "Make calls to Inference Providers" permission'
            : ""),
      );
    }

    return this.parse(await response.json(), texts.length);
  }

  /**
   * Validate shape before anything reaches the database. A silently wrong
   * vector length is how a vector index gets corrupted with no error.
   */
  private parse(payload: unknown, expectedCount: number): number[][] {
    if (!Array.isArray(payload)) {
      throw new ProviderContractError(
        `Expected an array of vectors, received ${typeof payload}`,
      );
    }

    if (payload.length !== expectedCount) {
      throw new ProviderContractError(
        `Expected ${expectedCount} vectors, received ${payload.length}`,
      );
    }

    return payload.map((vector, index) => {
      if (!Array.isArray(vector)) {
        throw new ProviderContractError(
          `Vector at index ${index} is not an array`,
        );
      }
      if (vector.length !== this.dimensions) {
        throw new ProviderContractError(
          `Vector at index ${index} has ${vector.length} dimensions, expected ${this.dimensions}`,
        );
      }
      if (!vector.every((n) => typeof n === "number" && Number.isFinite(n))) {
        throw new ProviderContractError(
          `Vector at index ${index} contains a non-finite value`,
        );
      }
      return vector as number[];
    });
  }
}
