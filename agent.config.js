/**
 * agent.config.js — Your agent, fully configured in one place.
 *
 * This is the only file most people need to edit.
 * Every setting is explained inline.
 *
 * After editing: push to Vercel → changes are live in seconds.
 */

/** @type {import('./core/types.js').AgentKitConfig} */
const config = {
  // ─── AI Model ─────────────────────────────────────────────────────────────
  model: {
    // Provider — must match the API key you set in .env.local
    // "gemini"    → FREE tier. Get key: https://aistudio.google.com
    // "openai"    → GPT-4o. Get key: https://platform.openai.com
    // "anthropic" → Claude. Get key: https://console.anthropic.com
    // "groq"      → FREE fast Llama. Get key: https://console.groq.com
    provider: "groq",

    // Model name. Must match your chosen provider:
    //   gemini:    "gemini-2.0-flash"
    //   openai:    "gpt-4o-mini"
    //   anthropic: "claude-3-5-haiku-20241022"
    //   groq:      "llama-3.3-70b-versatile"
    model: "llama-3.3-70b-versatile",

    // 0.0 = focused & precise  ←──────────────→  1.0 = creative & varied
    temperature: 0.7,

    // Max tokens per response (higher = longer answers, more API cost)
    maxTokens: 4096,
  },

  // ─── Memory ───────────────────────────────────────────────────────────────
  memory: {
    // Within-session memory — works out of the box, no setup needed
    shortTerm: true,

    // Cross-session memory — remembers users between visits
    // Requires: SUPABASE_URL + SUPABASE_ANON_KEY in .env.local
    longTerm: false,

    // Answer questions from your own documents (RAG)
    // Requires: Supabase with pgvector extension enabled
    knowledgeBase: false,
  },

  // ─── Bricks (Tools) ───────────────────────────────────────────────────────
  // List the tool names you want active.
  // Each brick is a file in /bricks/tools/<name>.js
  // Full list and setup guides: /docs/bricks.md
  bricks: [
    // ── No API key needed ────────────────────────────────────────────────
    "calculator", // Math, unit conversion, expressions
    "date-time", // Current date/time, timezone conversion
    "text-utils", // Summarise, translate, format text

    // ── Needs TAVILY_API_KEY (free 1000 searches/mo) ─────────────────────
    // "web-search",       // Live web search
    // "deep-research",    // Multi-source research + synthesis
    // "web-scraper",      // Read any URL as clean text

    // ── Needs Supabase ────────────────────────────────────────────────────
    // "remember",         // Store facts across sessions
    // "recall",           // Retrieve relevant memories
    // "knowledge-base",   // Search your own docs

    // ── Needs RESEND_API_KEY ──────────────────────────────────────────────
    // "email-send",       // Send emails

    // ── Needs TELEGRAM_BOT_TOKEN ──────────────────────────────────────────
    // "telegram-send",    // Send Telegram messages

    // ── Needs Google OAuth ────────────────────────────────────────────────
    // "gmail-reader",     // Read & search Gmail
    // "gmail-sender",     // Send Gmail
    // "google-calendar",  // Read/create calendar events
    // "google-docs",      // Read/write Google Docs
    // "google-sheets",    // Read/write Google Sheets
    // "google-drive",     // Search and list Drive files

    // ── Needs NOTION_TOKEN ────────────────────────────────────────────────
    // "notion",           // Read/write Notion pages & databases

    // ── Needs GITHUB_TOKEN ────────────────────────────────────────────────
    // "github",           // Issues, PRs, repos

    // ── Needs E2B_API_KEY ─────────────────────────────────────────────────
    // "code-executor",    // Run JS/Python in a sandbox
  ],

  // ─── Workflows ────────────────────────────────────────────────────────────
  // Automated pipelines that chain bricks together.
  // Each workflow is a YAML file in /bricks/workflows/
  // Uncomment to enable — make sure the required bricks are also enabled above.
  workflows: [
    // "daily-briefing",    // Scheduled: search → summarise → email each morning
    // "deep-research",     // On-demand: topic → research → write report → save
    // "inbox-zero",        // Scheduled: read Gmail → categorise → summarise
    // "lead-researcher",   // On-demand: company name → research → profile doc
  ],

  // ─── UI ───────────────────────────────────────────────────────────────────
  ui: {
    // "light" | "dark" | "system" (follows OS preference)
    theme: "system",

    // Show a card when the agent uses a tool
    showToolCalls: true,

    // Show a "thinking…" animation during multi-step reasoning
    showThinking: true,

    // Show "Built with AgentKit" badge — set false to white-label
    branding: true,

    // Quick-start prompts shown on an empty chat screen
    suggestedPrompts: [
      "What can you help me with?",
      "What tools do you have?",
      "Tell me something interesting",
    ],
  },

  // ─── System Prompt ────────────────────────────────────────────────────────
  // Write a custom system prompt here to fully control your agent's behaviour.
  // Set to null to use the persona below instead.
  systemPrompt: null,

  // ─── Persona ──────────────────────────────────────────────────────────────
  // Pick a built-in persona (ignored if systemPrompt is set above).
  // Options: "assistant" | "researcher" | "coder" | "tutor" | "sales" | "support"
  persona: "assistant",
};

export default config;
