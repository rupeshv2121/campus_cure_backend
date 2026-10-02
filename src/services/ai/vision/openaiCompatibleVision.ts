/**
 * Vision provider for OpenAI-compatible APIs (CC-50).
 *
 * Serves Groq and Mistral, which share `/chat/completions` but disagree on one
 * field. Both verified against the live APIs:
 *
 *   { "model": "<vision model>",
 *     "messages": [{ "role": "user", "content": [
 *        { "type": "text",      "text": "..." },
 *        { "type": "image_url", "image_url": <see below> }
 *     ]}] }
 *
 * Things worth recording:
 *
 *  - `image_url` shape differs per provider, and each rejects the other's:
 *      Groq    (2026-10-02): `{ "url": "data:..." }` — a string is a 400.
 *      Mistral (2026-09-23): `"data:..."` as a plain string — the object fails.
 *    Hence `imageUrlFormat` rather than a guess.
 *  - Reasoning models (Groq's Qwen3) may emit a `<think>` block ahead of the
 *    answer. It is stripped here, because the JSON parser downstream takes the
 *    first `{` it sees and a brace inside the reasoning would derail it.
 *  - The image is inlined as base64 rather than passed as a signed Supabase
 *    URL. A signed URL would be smaller on the wire, but it hands a third
 *    party a live credential to our private bucket, and the bucket is private
 *    precisely because complaint and doubt photos can identify people. Paying
 *    ~33% base64 overhead to keep the bytes in a request we control is the
 *    right side of that trade.
 */
import {
  EmptyVisionError,
  VisionProviderError,
  type VisionImage,
  type VisionProvider,
} from "./types.js";

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** How the provider wants the data URI wrapped. See the file header. */
export type ImageUrlFormat = "object" | "string";

export interface OpenAICompatibleVisionOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  imageUrlFormat: ImageUrlFormat;
  maxAttempts?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Drop any `<think>…</think>` reasoning a model emitted before its answer. */
const stripReasoning = (content: string): string =>
  content.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "").trim();

export class OpenAICompatibleVisionProvider implements VisionProvider {
  readonly name: string;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly imageUrlFormat: ImageUrlFormat;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: OpenAICompatibleVisionOptions) {
    this.name = options.name;
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.imageUrlFormat = options.imageUrlFormat;
    this.maxAttempts = options.maxAttempts ?? 3;
    // Longer than the chat provider's 45s: a megapixel image costs real time
    // to encode and read before the first token appears.
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleepImpl ?? defaultSleep;
  }

  async describe(
    image: VisionImage,
    instruction: string,
    options: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.attempt(image, instruction, options);
      } catch (error) {
        lastError = error as Error;

        const retryable =
          (error instanceof VisionProviderError && error.retryable) ||
          error instanceof EmptyVisionError;

        if (!retryable || attempt === this.maxAttempts) throw error;
        await this.sleep(2 ** (attempt - 1) * 1000);
      }
    }

    throw lastError ?? new VisionProviderError("Vision call failed");
  }

  private async attempt(
    image: VisionImage,
    instruction: string,
    options: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const dataUri = `data:${image.mimeType};base64,${image.data.toString("base64")}`;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: instruction },
                {
                  type: "image_url",
                  image_url:
                    this.imageUrlFormat === "object" ? { url: dataUri } : dataUri,
                },
              ],
            },
          ],
          max_tokens: options.maxTokens ?? 900,
          // Zero by default. This is transcription, not composition: we want
          // the same image to yield the same question every time.
          temperature: options.temperature ?? 0,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new VisionProviderError(
        `${this.name} request failed: ${(error as Error).message}`,
        undefined,
        true,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new VisionProviderError(
        `${this.name} returned ${response.status}: ${body.slice(0, 200)}`,
        response.status,
        RETRYABLE_STATUSES.has(response.status),
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | null };
        finish_reason?: string;
      }>;
    };

    const choice = payload.choices?.[0];
    const content = stripReasoning(choice?.message?.content ?? "");

    if (!content) {
      throw new EmptyVisionError(this.model, choice?.finish_reason);
    }

    return content;
  }
}
