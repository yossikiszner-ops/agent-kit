/**
 * core/model.js — Provider-agnostic model adapter (AI SDK v6)
 *
 * The rest of the codebase never imports @ai-sdk/* directly.
 * Switch providers by changing AI_PROVIDER in .env.local — nothing else changes.
 *
 * @module core/model
 */

import { serverEnv } from "@/lib/env.js";

/**
 * Returns an AI SDK v6 model instance for the configured provider.
 * Uses dynamic import() so unused provider SDKs are never loaded.
 *
 * @returns {Promise<import('ai').LanguageModelV1>}
 */
export async function getModel() {
  const { AI_PROVIDER: provider, AI_MODEL: modelId } = serverEnv;

  switch (provider) {
    case "gemini": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({
        apiKey: serverEnv.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return google(modelId);
    }

    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({ apiKey: serverEnv.OPENAI_API_KEY });
      return openai(modelId);
    }

    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({
        apiKey: serverEnv.ANTHROPIC_API_KEY,
      });
      return anthropic(modelId);
    }

    case "groq": {
      const { createGroq } = await import("@ai-sdk/groq");
      const groq = createGroq({ apiKey: serverEnv.GROQ_API_KEY });
      return groq(modelId);
    }

    default:
      throw new Error(
        `Unknown AI provider: "${provider}". Valid options: gemini, openai, anthropic, groq`
      );
  }
}

/**
 * Common generation options from env config.
 * Spread these into streamText / generateText calls.
 *
 * @returns {{ temperature: number, maxTokens: number }}
 */
export function getModelOptions() {
  return {
    temperature: serverEnv.AI_TEMPERATURE,
    maxTokens: serverEnv.AI_MAX_TOKENS,
  };
}
