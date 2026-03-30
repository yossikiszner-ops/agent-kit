/**
 * lib/env.js — Validated environment variables
 *
 * Import from here. Never use process.env directly elsewhere.
 * Missing required vars throw a clear startup error before the app runs.
 *
 * Usage:
 *   import { serverEnv, clientEnv, agentIdentity } from "@/lib/env.js";
 */

import * as z from "zod";

// ─── Server schema (secret keys — never sent to browser) ─────────────────────
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // AI
  AI_PROVIDER: z
    .enum(["gemini", "openai", "anthropic", "groq"])
    .default("gemini"),
  AI_MODEL: z.string().default("gemini-2.0-flash"),
  AI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.7),
  AI_MAX_TOKENS: z.coerce.number().min(100).max(32000).default(4096),

  // Provider keys — all optional individually; one must match AI_PROVIDER
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Tools
  TAVILY_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  E2B_API_KEY: z.string().optional(),
  NOTION_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_PER_MINUTE: z.coerce.number().min(1).max(1000).default(20),

  // Cron + workflows
  CRON_SECRET: z.string().optional(),
  OWNER_EMAIL: z.string().email().optional(),

  // Registry
  REGISTRY_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

// ─── Client schema (NEXT_PUBLIC_ only — safe to expose) ─────────────────────
const clientSchema = z.object({
  NEXT_PUBLIC_AGENT_NAME: z.string().min(1).default("My Agent"),
  NEXT_PUBLIC_AGENT_DESCRIPTION: z
    .string()
    .default("A helpful AI assistant"),
  NEXT_PUBLIC_AGENT_COLOR: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex colour like #0F6E56")
    .default("#0F6E56"),
  NEXT_PUBLIC_AGENT_INITIALS: z.string().min(1).max(3).default("AG"),
  NEXT_PUBLIC_AGENT_WELCOME: z
    .string()
    .default("Hi! How can I help you today?"),
  NEXT_PUBLIC_AGENT_THEME: z
    .enum(["light", "dark", "system"])
    .default("system"),
  NEXT_PUBLIC_SHOW_BRANDING: z
    .string()
    .transform((v) => v !== "false")
    .default("true"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
});

// ─── Parse server env ─────────────────────────────────────────────────────────
function parseServerEnv() {
  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid environment variables:\n${issues}\n\nFix your .env.local file.\n`
    );
  }

  const env = result.data;

  // Ensure the selected provider's key is present
  const keyMap = {
    gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    groq: "GROQ_API_KEY",
  };
  const needed = keyMap[env.AI_PROVIDER];
  if (!env[needed]) {
    throw new Error(
      `\n❌ Missing API key for provider "${env.AI_PROVIDER}".\n` +
        `  Add ${needed}="your-key" to .env.local\n` +
        `  Free keys:\n` +
        `    gemini    → https://aistudio.google.com\n` +
        `    openai    → https://platform.openai.com\n` +
        `    anthropic → https://console.anthropic.com\n` +
        `    groq      → https://console.groq.com\n`
    );
  }

  return env;
}

// ─── Parse client env ─────────────────────────────────────────────────────────
function parseClientEnv() {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_AGENT_NAME: process.env.NEXT_PUBLIC_AGENT_NAME,
    NEXT_PUBLIC_AGENT_DESCRIPTION: process.env.NEXT_PUBLIC_AGENT_DESCRIPTION,
    NEXT_PUBLIC_AGENT_COLOR: process.env.NEXT_PUBLIC_AGENT_COLOR,
    NEXT_PUBLIC_AGENT_INITIALS: process.env.NEXT_PUBLIC_AGENT_INITIALS,
    NEXT_PUBLIC_AGENT_WELCOME: process.env.NEXT_PUBLIC_AGENT_WELCOME,
    NEXT_PUBLIC_AGENT_THEME: process.env.NEXT_PUBLIC_AGENT_THEME,
    NEXT_PUBLIC_SHOW_BRANDING: process.env.NEXT_PUBLIC_SHOW_BRANDING,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    console.warn("[AgentKit] Client env issues:", result.error.issues);
    return clientSchema.parse({});
  }

  return result.data;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Server-only env. Import only in server files (API routes, Server Components).
 * Returns null in the browser to prevent accidental key exposure.
 */
export const serverEnv =
  typeof window === "undefined" ? parseServerEnv() : null;

/**
 * Client-safe env (NEXT_PUBLIC_ vars only). Safe to import anywhere.
 */
export const clientEnv = parseClientEnv();

/**
 * Convenience object for agent identity — safe to use in any component.
 */
export const agentIdentity = {
  name: clientEnv.NEXT_PUBLIC_AGENT_NAME,
  description: clientEnv.NEXT_PUBLIC_AGENT_DESCRIPTION,
  color: clientEnv.NEXT_PUBLIC_AGENT_COLOR,
  initials: clientEnv.NEXT_PUBLIC_AGENT_INITIALS,
  welcome: clientEnv.NEXT_PUBLIC_AGENT_WELCOME,
  theme: clientEnv.NEXT_PUBLIC_AGENT_THEME,
  showBranding: clientEnv.NEXT_PUBLIC_SHOW_BRANDING,
  appUrl: clientEnv.NEXT_PUBLIC_APP_URL,
};
