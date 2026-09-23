/**
 * Mistral vision provider (CC-50).
 *
 * Verified against the live API on 2026-09-23:
 *
 *   POST https://api.mistral.ai/v1/chat/completions
 *   { "model": "<vision model>",
 *     "messages": [{ "role": "user", "content": [
 *        { "type": "text",      "text": "..." },
 *        { "type": "image_url", "image_url": "data:image/png;base64,..." }
 *     ]}] }
 *
 * Two things worth recording:
 *
 *  - `image_url` takes the data URI as a plain STRING here, not the
 *    `{ url: ... }` object OpenAI uses. Sending the object shape fails.
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

export interface MistralVisionOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxAttempts?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MistralVisionProvider implements VisionProvider {
  readonly name = "mistral-vision";
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: MistralVisionOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl ?? "https://api.mistral.ai/v1").replace(
      /\/$/,
      "",
    );
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
                { type: "image_url", image_url: dataUri },
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
    const content = choice?.message?.content?.trim() ?? "";

    if (!content) {
      throw new EmptyVisionError(this.model, choice?.finish_reason);
    }

    return content;
  }
}
