import { serverEnv } from "@/lib/env.js";

export async function getModel(runtimeModel) {
  const provider = serverEnv.AI_PROVIDER;
  const modelId = runtimeModel || serverEnv.AI_MODEL;
  switch (provider) {
    case "gemini": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({ apiKey: serverEnv.GOOGLE_GENERATIVE_AI_API_KEY });
      return google(modelId);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey: serverEnv.OPENAI_API_KEY })(modelId);
    }
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY })(modelId);
    }
    case "groq": {
      const { createGroq } = await import("@ai-sdk/groq");
      return createGroq({ apiKey: serverEnv.GROQ_API_KEY })(modelId);
    }
    default: throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export function getModelOptions(runtimeSettings = {}) {
  return {
    temperature: runtimeSettings.temperature ?? serverEnv.AI_TEMPERATURE,
    maxTokens: serverEnv.AI_MAX_TOKENS,
  };
}
