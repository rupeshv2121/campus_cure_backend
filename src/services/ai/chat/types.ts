/**
 * Chat provider contract.
 *
 * Unlike embeddings, generation CAN fail over between providers: the output is
 * text, not a vector that must live in a shared space with everything else.
 * See docs/adr/0001-ai-provider-strategy.md.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Returns the assistant's text.
   *
   * Throws `EmptyCompletionError` when the model returns no content. That is
   * not a rare edge case: `gpt-oss` is a reasoning model whose reasoning tokens
   * draw from the same budget as content, so a small `maxTokens` yields
   * `content: ""` with `finish_reason: "stop"` — success-shaped, but empty.
   */
  complete(
    messages: ChatMessage[],
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<string>;
}

export class EmptyCompletionError extends Error {
  constructor(model: string, finishReason?: string) {
    super(
      `${model} returned empty content (finish_reason: ${finishReason ?? "unknown"}). ` +
        `For reasoning models this usually means max_tokens was consumed by reasoning.`,
    );
    this.name = "EmptyCompletionError";
  }
}

export class ChatProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ChatProviderError";
  }
}
