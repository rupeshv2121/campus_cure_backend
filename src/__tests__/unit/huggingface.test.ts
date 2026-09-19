/**
 * CC-10: HuggingFace embedding provider.
 *
 * All offline — `fetch` and `sleep` are injected, so retry behaviour is tested
 * without network access and without the suite sleeping for seconds.
 */
import { describe, expect, it, vi } from "vitest";
import {
  ProviderContractError,
  RetryableProviderError,
} from "../../services/ai/types.js";
import { HuggingFaceEmbeddingProvider } from "../../services/ai/embeddings/huggingface.js";

const DIMS = 4; // small stand-in for 384; the logic is dimension-agnostic

const vector = (seed: number) => Array.from({ length: DIMS }, (_, i) => seed + i);

const okResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const errorResponse = (status: number, body = "boom") =>
  ({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  }) as unknown as Response;

const makeProvider = (fetchImpl: typeof fetch, maxAttempts = 4) =>
  new HuggingFaceEmbeddingProvider({
    token: "hf_test",
    model: "test/model",
    dimensions: DIMS,
    maxAttempts,
    fetchImpl,
    sleepImpl: async () => undefined, // no real backoff in tests
  });

describe("HuggingFaceEmbeddingProvider", () => {
  it("returns one vector per input, in order", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse([vector(0), vector(10)]),
    ) as unknown as typeof fetch;

    const result = await makeProvider(fetchImpl).embed(["a", "b"]);

    expect(result).toEqual([vector(0), vector(10)]);
  });

  it("sends the whole batch in a single request", async () => {
    const fetchImpl = vi.fn(async () =>
      okResponse([vector(0), vector(1), vector(2)]),
    ) as unknown as typeof fetch;

    await makeProvider(fetchImpl).embed(["a", "b", "c"]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (vi.mocked(fetchImpl).mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body.inputs).toEqual(["a", "b", "c"]);
  });

  it("makes no request at all for an empty batch", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(await makeProvider(fetchImpl).embed([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries a 503 (cold model) and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503, "Model is currently loading"))
      .mockResolvedValueOnce(okResponse([vector(0)])) as unknown as typeof fetch;

    const result = await makeProvider(fetchImpl).embed(["a"]);

    expect(result).toEqual([vector(0)]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries a 429 (rate limited) rather than failing immediately", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, "Too Many Requests"))
      .mockResolvedValueOnce(okResponse([vector(5)])) as unknown as typeof fetch;

    expect(await makeProvider(fetchImpl).embed(["a"])).toEqual([vector(5)]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts and reports the last error", async () => {
    const fetchImpl = vi.fn(async () =>
      errorResponse(503),
    ) as unknown as typeof fetch;

    await expect(makeProvider(fetchImpl, 3).embed(["a"])).rejects.toBeInstanceOf(
      RetryableProviderError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries a network failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(okResponse([vector(1)])) as unknown as typeof fetch;

    expect(await makeProvider(fetchImpl).embed(["a"])).toEqual([vector(1)]);
  });

  describe("non-retryable failures", () => {
    it("does not retry a 403, and explains the likely cause", async () => {
      const fetchImpl = vi.fn(async () =>
        errorResponse(403, "insufficient permissions"),
      ) as unknown as typeof fetch;

      await expect(makeProvider(fetchImpl).embed(["a"])).rejects.toThrow(
        /Make calls to Inference Providers/,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("does not retry a 401", async () => {
      const fetchImpl = vi.fn(async () =>
        errorResponse(401),
      ) as unknown as typeof fetch;

      await expect(makeProvider(fetchImpl).embed(["a"])).rejects.toBeInstanceOf(
        ProviderContractError,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * These are the ones that matter most: a malformed vector reaching the
   * database corrupts the index silently, with no error at write time and
   * meaningless results at query time.
   */
  describe("response validation", () => {
    it("rejects a vector of the wrong dimension", async () => {
      const fetchImpl = vi.fn(async () =>
        okResponse([[1, 2]]),
      ) as unknown as typeof fetch;

      await expect(makeProvider(fetchImpl).embed(["a"])).rejects.toThrow(
        /has 2 dimensions, expected 4/,
      );
    });

    it("rejects a response with the wrong number of vectors", async () => {
      const fetchImpl = vi.fn(async () =>
        okResponse([vector(0)]),
      ) as unknown as typeof fetch;

      await expect(makeProvider(fetchImpl).embed(["a", "b"])).rejects.toThrow(
        /Expected 2 vectors, received 1/,
      );
    });

    it("rejects a non-finite value", async () => {
      const fetchImpl = vi.fn(async () =>
        okResponse([[1, 2, 3, Number.NaN]]),
      ) as unknown as typeof fetch;

      await expect(makeProvider(fetchImpl).embed(["a"])).rejects.toThrow(
        /non-finite/,
      );
    });

    it("rejects a payload that is not an array", async () => {
      const fetchImpl = vi.fn(async () =>
        okResponse({ error: "nope" }),
      ) as unknown as typeof fetch;

      await expect(makeProvider(fetchImpl).embed(["a"])).rejects.toThrow(
        /Expected an array of vectors/,
      );
    });
  });
});
