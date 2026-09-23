/**
 * Vision provider selection (CC-50).
 *
 * There is no fallback list here, and that is a finding rather than an
 * omission. Generation fails over between Groq and Mistral because any fluent
 * paragraph substitutes for any other. Vision cannot: as of 2026-09-23 the
 * Groq catalogue on our key is text-only (gpt-oss, qwen, whisper, guard — no
 * multimodal model), so Mistral is the only provider that can read an image.
 *
 * The consequence is recorded in the spec: image doubts are the one AI feature
 * with a single point of failure, and the UI must degrade to "type it out
 * yourself" rather than pretend.
 */
import {
  MISTRAL_API_KEY,
  MISTRAL_VISION_MODEL,
  VISION_ENABLED,
} from "../../../config/env.js";
import { MistralVisionProvider } from "./mistralVision.js";
import type { VisionImage, VisionProvider } from "./types.js";

let cached: VisionProvider | null = null;

/** The configured provider, or null when image understanding is unavailable. */
export const getVisionProvider = (): VisionProvider | null => {
  if (!VISION_ENABLED || !MISTRAL_API_KEY) return null;

  if (!cached) {
    cached = new MistralVisionProvider({
      apiKey: MISTRAL_API_KEY,
      model: MISTRAL_VISION_MODEL,
    });
  }

  return cached;
};

export interface VisionResult {
  content: string;
  provider: string;
  model: string;
}

/**
 * Describe an image, or return null.
 *
 * Null rather than a throw, matching `completeWithFallback`: every AI path in
 * this codebase is an enhancement, and no caller should return a 500 because
 * a third party was slow. The distinction the caller needs — "unavailable" vs
 * "failed" — is carried by `isVisionAvailable`, so the route can answer 503
 * for the former and a softer error for the latter.
 */
export const describeImage = async (
  image: VisionImage,
  instruction: string,
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<VisionResult | null> => {
  const provider = getVisionProvider();
  if (!provider) return null;

  try {
    const content = await provider.describe(image, instruction, options);
    return { content, provider: provider.name, model: provider.model };
  } catch (error) {
    console.error("[CC-50] vision call failed:", (error as Error).message);
    return null;
  }
};

/** Whether the feature is configured at all, independent of whether it worked. */
export const isVisionAvailable = (): boolean => getVisionProvider() !== null;

/** Test seam. */
export const resetVisionProvider = (): void => {
  cached = null;
};

export type { VisionImage, VisionProvider } from "./types.js";
