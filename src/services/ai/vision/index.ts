/**
 * Vision provider selection (CC-50).
 *
 * Groq first, Mistral as fallback — but only Groq is live. Mistral's account
 * has had no inference quota since 2026-09-23, and Groq gained a usable
 * multimodal model (`qwen/qwen3.8-27b`) on our second key, checked 2026-10-02.
 * Mistral stays wired so restoring its quota is a config change, not a code one.
 *
 * Failing over is safe here for the same reason it is for generation: both
 * providers are given the same instruction and the output is parsed the same
 * way, so a transcription from either is equally usable.
 *
 * With only one key configured, image doubts have a single point of failure,
 * and the UI must degrade to "type it out yourself" rather than pretend.
 */
import {
  GROQ_VISION_API_KEY,
  GROQ_VISION_MODEL,
  MISTRAL_API_KEY,
  MISTRAL_VISION_MODEL,
  VISION_ENABLED,
} from "../../../config/env.js";
import { OpenAICompatibleVisionProvider } from "./openaiCompatibleVision.js";
import type { VisionImage, VisionProvider } from "./types.js";

let cached: VisionProvider[] | null = null;

/** Configured providers, best first. Empty when image understanding is unavailable. */
export const getVisionProviders = (): VisionProvider[] => {
  if (!VISION_ENABLED) return [];

  if (!cached) {
    const providers: VisionProvider[] = [];

    if (GROQ_VISION_API_KEY) {
      providers.push(
        new OpenAICompatibleVisionProvider({
          name: "groq-vision",
          baseUrl: "https://api.groq.com/openai/v1",
          apiKey: GROQ_VISION_API_KEY,
          model: GROQ_VISION_MODEL,
          imageUrlFormat: "object",
        }),
      );
    }

    if (MISTRAL_API_KEY) {
      providers.push(
        new OpenAICompatibleVisionProvider({
          name: "mistral-vision",
          baseUrl: "https://api.mistral.ai/v1",
          apiKey: MISTRAL_API_KEY,
          model: MISTRAL_VISION_MODEL,
          imageUrlFormat: "string",
        }),
      );
    }

    cached = providers;
  }

  return cached;
};

export interface VisionResult {
  content: string;
  provider: string;
  model: string;
}

/**
 * Describe an image with the first provider that succeeds, or return null.
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
  for (const provider of getVisionProviders()) {
    try {
      const content = await provider.describe(image, instruction, options);
      return { content, provider: provider.name, model: provider.model };
    } catch (error) {
      console.error(
        `[CC-50] ${provider.name} failed:`,
        (error as Error).message,
      );
    }
  }

  return null;
};

/** Whether the feature is configured at all, independent of whether it worked. */
export const isVisionAvailable = (): boolean => getVisionProviders().length > 0;

/** Test seam. */
export const resetVisionProvider = (): void => {
  cached = null;
};

export type { VisionImage, VisionProvider } from "./types.js";
