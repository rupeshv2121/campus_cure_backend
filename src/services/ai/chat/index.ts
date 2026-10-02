/**
 * Chat provider selection with fallback.
 *
 * Generation may fail over between providers — the output is text, so any
 * provider's answer is as usable as another's. This is the opposite of
 * embeddings, where substituting a provider silently corrupts the index
 * (ADR-0001).
 *
 * Order: Groq, then the second Groq key, then Mistral. The second key is a
 * separate Groq project, so it survives the first key being rate-limited or
 * revoked; Mistral stays last because its account has had no quota since
 * 2026-09-23.
 */
import {
  AI_ENABLED,
  GROQ_API_KEY,
  GROQ_API_KEY2,
  GROQ_MODEL,
  MISTRAL_API_KEY,
  MISTRAL_MODEL,
} from "../../../config/env.js";
import { OpenAICompatibleChatProvider } from "./openaiCompatible.js";
import type { ChatMessage, ChatProvider } from "./types.js";

let cached: ChatProvider[] | null = null;

/** Configured providers, best first. Empty when generation is unavailable. */
export const getChatProviders = (): ChatProvider[] => {
  if (!AI_ENABLED) return [];

  if (!cached) {
    const providers: ChatProvider[] = [];

    if (GROQ_API_KEY) {
      providers.push(
        new OpenAICompatibleChatProvider({
          name: "groq",
          baseUrl: "https://api.groq.com/openai/v1",
          apiKey: GROQ_API_KEY,
          model: GROQ_MODEL,
        }),
      );
    }

    if (GROQ_API_KEY2) {
      providers.push(
        new OpenAICompatibleChatProvider({
          name: "groq-2",
          baseUrl: "https://api.groq.com/openai/v1",
          apiKey: GROQ_API_KEY2,
          model: GROQ_MODEL,
        }),
      );
    }

    if (MISTRAL_API_KEY) {
      providers.push(
        new OpenAICompatibleChatProvider({
          name: "mistral",
          baseUrl: "https://api.mistral.ai/v1",
          apiKey: MISTRAL_API_KEY,
          model: MISTRAL_MODEL,
        }),
      );
    }

    cached = providers;
  }

  return cached;
};

export interface CompletionResult {
  content: string;
  provider: string;
  model: string;
}

/**
 * Complete with the first provider that succeeds.
 *
 * Returns null rather than throwing when every provider fails: generation is
 * always an enhancement here, and no caller should break because it was
 * unavailable.
 */
export const completeWithFallback = async (
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {},
): Promise<CompletionResult | null> => {
  const providers = getChatProviders();
  if (providers.length === 0) return null;

  for (const provider of providers) {
    try {
      const content = await provider.complete(messages, options);
      return { content, provider: provider.name, model: provider.model };
    } catch (error) {
      console.error(
        `[chat] ${provider.name} failed:`,
        (error as Error).message,
      );
    }
  }

  return null;
};

/** Test seam. */
export const resetChatProviders = (): void => {
  cached = null;
};
