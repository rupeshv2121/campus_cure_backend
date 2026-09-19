/**
 * Chat provider for OpenAI-compatible APIs.
 *
 * Groq and Mistral both expose `/chat/completions` with the same request and
 * response shape, so one implementation serves both — only the base URL, key
 * and model differ. Verified against both on 2026-09-20.
 */
import {
  ChatProviderError,
  EmptyCompletionError,
  type ChatMessage,
  type ChatProvider,
} from "./types.js";

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface OpenAICompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxAttempts?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class OpenAICompatibleChatProvider implements ChatProvider {
  readonly name: string;
  readonly model: string;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: OpenAICompatibleOptions) {
    this.name = options.name;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleepImpl ?? defaultSleep;
  }

  async complete(
    messages: ChatMessage[],
    options: { maxTokens?: number; temperature?: number } = {},
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.attempt(messages, options);
      } catch (error) {
        lastError = error as Error;

        const retryable =
          (error instanceof ChatProviderError && error.retryable) ||
          error instanceof EmptyCompletionError;

        if (!retryable || attempt === this.maxAttempts) throw error;
        await this.sleep(2 ** (attempt - 1) * 1000);
      }
    }

    throw lastError ?? new Error("Chat completion failed");
  }

  private async attempt(
    messages: ChatMessage[],
    options: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

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
          messages,
          // Generous by default: reasoning models spend part of this budget
          // before emitting a single character of the answer.
          max_tokens: options.maxTokens ?? 1500,
          temperature: options.temperature ?? 0.3,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ChatProviderError(
        `${this.name} request failed: ${(error as Error).message}`,
        undefined,
        true,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ChatProviderError(
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

    // Success-shaped but empty. Treated as a failure so it is retried rather
    // than stored as a draft — see EmptyCompletionError.
    if (!content) {
      throw new EmptyCompletionError(this.model, choice?.finish_reason);
    }

    return content;
  }
}
