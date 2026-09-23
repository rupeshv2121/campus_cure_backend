/**
 * CC-50: the Mistral vision provider.
 *
 * All offline — `fetch` and `sleep` are injected, so the retry ladder is
 * exercised without network access and without the suite actually sleeping.
 *
 * The request shape is asserted in detail because it was discovered by trial
 * against the live API rather than read from a stable spec: Mistral takes
 * `image_url` as a bare string, where the OpenAI shape everything else in this
 * codebase follows would send `{ url }`. A refactor that "tidies" that into an
 * object breaks the feature with a 422 that looks nothing like the cause.
 */
import { describe, expect, it, vi } from "vitest";
import { MistralVisionProvider } from "../../services/ai/vision/mistralVision.js";
import {
  EmptyVisionError,
  VisionProviderError,
} from "../../services/ai/vision/types.js";

const okResponse = (content: string, finishReason = "stop") =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: finishReason }],
    }),
    text: async () => "",
  }) as unknown as Response;

const errorResponse = (status: number, body = "boom") =>
  ({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  }) as unknown as Response;

const makeProvider = (fetchImpl: typeof fetch, maxAttempts = 3) =>
  new MistralVisionProvider({
    apiKey: "sk-test",
    model: "vision-test",
    maxAttempts,
    fetchImpl,
    sleepImpl: async () => undefined,
  });

const image = { data: Buffer.from("PNGBYTES"), mimeType: "image/png" };

/** The parsed JSON body of the Nth fetch call. */
const bodyOf = (fetchImpl: ReturnType<typeof vi.fn>, n = 0) =>
  JSON.parse((fetchImpl.mock.calls[n]?.[1] as { body: string }).body) as {
    model: string;
    temperature: number;
    max_tokens: number;
    messages: Array<{
      role: string;
      content: Array<{ type: string; text?: string; image_url?: string }>;
    }>;
  };

describe("MistralVisionProvider", () => {
  it("returns the description", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("a question"));
    await expect(
      makeProvider(fetchImpl as unknown as typeof fetch).describe(image, "read it"),
    ).resolves.toBe("a question");
  });

  it("inlines the image as a base64 data URI, as a bare string", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("ok"));
    await makeProvider(fetchImpl as unknown as typeof fetch).describe(
      image,
      "read it",
    );

    const parts = bodyOf(fetchImpl).messages[0]!.content;
    expect(parts[0]).toEqual({ type: "text", text: "read it" });
    expect(parts[1]!.type).toBe("image_url");
    // A bare string, NOT { url: ... } — see the file header.
    expect(typeof parts[1]!.image_url).toBe("string");
    expect(parts[1]!.image_url).toBe(
      `data:image/png;base64,${Buffer.from("PNGBYTES").toString("base64")}`,
    );
  });

  /**
   * Transcription, not composition. The same photograph must yield the same
   * question every time, or a student who re-reads an image sees it change
   * under them and stops trusting it.
   */
  it("defaults to temperature 0", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("ok"));
    await makeProvider(fetchImpl as unknown as typeof fetch).describe(image, "x");
    expect(bodyOf(fetchImpl).temperature).toBe(0);
  });

  it("never sends the API key anywhere but the Authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("ok"));
    await makeProvider(fetchImpl as unknown as typeof fetch).describe(image, "x");

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("sk-test");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test",
    );
    expect(init.body as string).not.toContain("sk-test");
  });

  it("retries a 429 and succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse("second time"));

    await expect(
      makeProvider(fetchImpl as unknown as typeof fetch).describe(image, "x"),
    ).resolves.toBe("second time");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  /**
   * A 401 is a configuration mistake, not weather. Retrying it spends latency
   * to be told the same thing three times.
   */
  it("does not retry a 401", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errorResponse(401, "bad key"));

    await expect(
      makeProvider(fetchImpl as unknown as typeof fetch).describe(image, "x"),
    ).rejects.toBeInstanceOf(VisionProviderError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts and reports the status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errorResponse(503));

    const error = await makeProvider(fetchImpl as unknown as typeof fetch, 3)
      .describe(image, "x")
      .catch((e: unknown) => e as VisionProviderError);

    expect(error).toBeInstanceOf(VisionProviderError);
    expect((error as VisionProviderError).status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  /** Success-shaped but empty. Retried, then surfaced as its own error type. */
  it("treats an empty completion as retryable, then throws EmptyVisionError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse("   ", "length"));

    await expect(
      makeProvider(fetchImpl as unknown as typeof fetch, 2).describe(image, "x"),
    ).rejects.toBeInstanceOf(EmptyVisionError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("turns a network failure into a retryable provider error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    const error = await makeProvider(fetchImpl as unknown as typeof fetch, 2)
      .describe(image, "x")
      .catch((e: unknown) => e as VisionProviderError);

    expect((error as VisionProviderError).retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
