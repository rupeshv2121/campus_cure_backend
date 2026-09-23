/**
 * Vision provider contract (CC-50).
 *
 * Deliberately narrow: one call, one image, one text instruction, text back.
 * There is no multi-turn and no tool calling here — a doubt is extracted in a
 * single shot, and anything conversational belongs to CC-15's chat provider.
 *
 * Kept separate from `../chat/types.ts` even though both end up POSTing to a
 * `/chat/completions` endpoint. The reason is failover: generation can fall
 * back from Groq to Mistral because one paragraph of text substitutes for
 * another, but vision has exactly one provider on our keys, so a caller must
 * be able to ask "can I read images?" without that question being entangled
 * with "can I generate text?".
 */

/** One image, already in memory. The bytes never round-trip through disk. */
export interface VisionImage {
  /** Raw bytes as fetched from storage. */
  data: Buffer;
  /** Allow-listed MIME type. Used to build the data URI, so it must be real. */
  mimeType: string;
}

export interface VisionProvider {
  readonly name: string;
  readonly model: string;

  /**
   * Describe an image according to `instruction`.
   *
   * Throws rather than returning empty: unlike a chat reply, an empty
   * transcription is never a legitimate answer, and silently returning "" here
   * would present the student with a blank form and no explanation.
   */
  describe(
    image: VisionImage,
    instruction: string,
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<string>;
}

/**
 * The provider refused or failed.
 *
 * `retryable` distinguishes a transient 429/5xx from a permanent rejection
 * (a bad key, an unsupported image). Only the former is worth a second call —
 * retrying a 401 just spends latency to get the same answer.
 */
export class VisionProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "VisionProviderError";
  }
}

/**
 * The model returned success with no usable content.
 *
 * Treated as retryable for the same reason CC-12 treats it that way: a model
 * that spends its budget before emitting a character returns a 200 with an
 * empty string, which is a failure wearing a success's clothes.
 */
export class EmptyVisionError extends Error {
  constructor(model: string, finishReason?: string) {
    super(
      `${model} returned no description (finish_reason: ${finishReason ?? "unknown"}).`,
    );
    this.name = "EmptyVisionError";
  }
}
