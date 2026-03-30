# AgentKit

**Fork → configure → deploy. Your own AI agent, live in minutes.**

AgentKit is a fully modular, open-source AI agent template built on Next.js 16.
One config file. Every major AI provider. 20+ tools ready to enable.
No server required — deploys free on Vercel.

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/smartly-ventures/agentkit&env=AI_PROVIDER,GOOGLE_GENERATIVE_AI_API_KEY,NEXT_PUBLIC_AGENT_NAME&envDescription=Configure%20your%20agent&envLink=https://github.com/smartly-ventures/agentkit%23environment-variables&project-name=my-agent&repository-name=my-agent)

---

## What you get

- **One config file** — everything about your agent lives in `agent.config.js`
- **Any AI model** — Gemini (free), GPT-4o, Claude, Groq — switch with one line
- **20+ tools (bricks)** — web search, email, Telegram, Google Workspace, Notion, GitHub…
- **Programmable workflows** — chain tools into automated pipelines via YAML
- **Three-tier memory** — session, long-term, and RAG knowledge base
- **Beautiful chat UI** — streaming, markdown, tool-call cards, dark mode
- **Production-ready** — rate limiting, input validation, security headers, CI/CD

---

## Quick start

### Option 1 — One-click deploy (no setup needed)

Click the **Deploy to Vercel** button above. Enter your Gemini API key (free at [aistudio.google.com](https://aistudio.google.com)) and your agent name. Done — live in 60 seconds.

### Option 2 — Fork and customise

```bash
# 1. Fork this repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/agentkit.git
cd agentkit

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local — at minimum add GOOGLE_GENERATIVE_AI_API_KEY and NEXT_PUBLIC_AGENT_NAME

# 4. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — your agent is running.

---

## Configure your agent

Open `agent.config.js`. This is the only file you need to edit for most use cases.

```js
const config = {
  model: {
    provider: "gemini",         // gemini | openai | anthropic | groq
    model: "gemini-2.0-flash",  // model name for your provider
    temperature: 0.7,
  },

  bricks: [
    "calculator",    // enabled by default — no key needed
    "web-search",    // needs TAVILY_API_KEY
    "email-send",    // needs RESEND_API_KEY
    // ... see all bricks below
  ],

  ui: {
    theme: "system",        // light | dark | system
    showToolCalls: true,    // show tool execution in chat
    branding: true,         // "Built with AgentKit" badge
  },

  persona: "assistant",  // assistant | researcher | coder | tutor | sales | support
};
```

---

## All bricks

Enable any brick by adding its name to `bricks[]` in `agent.config.js`.

| Brick | What it does | Requires |
|---|---|---|
| **Free — no key needed** | | |
| `calculator` | Math, unit conversion, expressions | Nothing |
| `date-time` | Date/time, timezone conversion, durations | Nothing |
| `text-utils` | Word count, keywords, readability, slug | Nothing |
| `weather` | Current weather + 7-day forecast for any city | Nothing (Open-Meteo) |
| `web-scraper` | Read any public URL as clean text | Nothing |
| `http-request` | Call any REST API with custom headers/body | Nothing |
| `rss-reader` | Fetch and parse any RSS or Atom feed | Nothing |
| **Needs free API key** | | |
| `web-search` | Real-time web search | `TAVILY_API_KEY` |
| `deep-research` | Multi-angle research + source synthesis | `TAVILY_API_KEY` |
| `email-send` | Send emails via Resend | `RESEND_API_KEY` |
| `telegram-send` | Send Telegram messages | `TELEGRAM_BOT_TOKEN` |
| `slack-send` | Post to Slack channels | `SLACK_WEBHOOK_URL` or `SLACK_BOT_TOKEN` |
| `notion` | Read/write Notion pages & databases | `NOTION_TOKEN` |
| `github` | Issues, PRs, repos, code search | `GITHUB_TOKEN` |
| `code-executor` | Run JS/Python in a secure sandbox | `E2B_API_KEY` |
| **Needs Supabase (free)** | | |
| `remember` | Store facts in long-term memory | Supabase |
| `recall` | Retrieve relevant memories | Supabase |
| `knowledge-base` | Semantic search over your documents | Supabase + pgvector |
| **Needs Google OAuth** | | |
| `gmail-reader` | Read and search Gmail | Google OAuth |
| `gmail-sender` | Compose and send Gmail | Google OAuth |
| `google-calendar` | Read/create calendar events | Google OAuth |
| `google-sheets` | Read/write/append spreadsheet data | Google OAuth |
| `google-docs` | Read, create, edit Google Docs | Google OAuth |
| `google-drive` | Search, list, and read Drive files | Google OAuth |

---

## Writing a custom brick

Create a file in `bricks/tools/my-brick.js`:

```js
import * as z from "zod";

const brick = {
  name: "my-brick",
  description: "What this tool does — the AI reads this to decide when to use it.",

  // Optional: env vars required. Clear error shown at startup if missing.
  requiredEnvVars: ["MY_API_KEY"],

  // Zod schema for the tool's input
  parameters: z.object({
    query: z.string().describe("What to look up"),
  }),

  // The tool's logic — must return JSON-serialisable data
  execute: async ({ query }) => {
    const result = await myApi.lookup(query);
    return { result };
  },

  // Friendly error message returned to the AI on failure
  onError: (err) => `My tool failed: ${err.message}`,
};

export default brick;
```

Then add `"my-brick"` to `bricks[]` in `agent.config.js`. That's it.

---

## Workflows

Workflows chain bricks into automated pipelines. Create a YAML file in `bricks/workflows/`:

```yaml
name: morning-summary
description: Search news and send a daily email digest

trigger:
  type: cron
  schedule: "0 7 * * *"   # 7am UTC

steps:
  - id: search
    brick: web-search
    input:
      query: "tech news today"
      maxResults: 5

  - id: send-email
    brick: email-send
    input:
      to: "{{env.OWNER_EMAIL}}"
      subject: "Morning Summary"
      body: "{{steps.search.answer}}"
```

Enable it in `agent.config.js` → `workflows: ["morning-summary"]`.

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values you need.

| Variable | Required | Description |
|---|---|---|
| **AI provider (add the one you use)** | | |
| `GOOGLE_GENERATIVE_AI_API_KEY` | If using Gemini | [aistudio.google.com](https://aistudio.google.com) — free |
| `OPENAI_API_KEY` | If using OpenAI | [platform.openai.com](https://platform.openai.com) |
| `ANTHROPIC_API_KEY` | If using Anthropic | [console.anthropic.com](https://console.anthropic.com) |
| `GROQ_API_KEY` | If using Groq | [console.groq.com](https://console.groq.com) — free |
| **Agent identity** | | |
| `NEXT_PUBLIC_AGENT_NAME` | Yes | Your agent's display name |
| `NEXT_PUBLIC_AGENT_COLOR` | No | Brand hex colour, e.g. `#0F6E56` |
| `NEXT_PUBLIC_AGENT_THEME` | No | `light`, `dark`, or `system` |
| `NEXT_PUBLIC_AGENT_WELCOME` | No | Opening message in the chat |
| **Bricks** | | |
| `TAVILY_API_KEY` | For web-search/deep-research | [tavily.com](https://tavily.com) — 1000 free/mo |
| `RESEND_API_KEY` | For email-send | [resend.com](https://resend.com) — 3000 free/mo |
| `EMAIL_FROM` | For email-send | Sender address, e.g. `me@domain.com` |
| `TELEGRAM_BOT_TOKEN` | For telegram-send | Create via [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | For Telegram workflows | Get from [@userinfobot](https://t.me/userinfobot) |
| `SLACK_WEBHOOK_URL` | For slack-send | [api.slack.com/messaging/webhooks](https://api.slack.com/messaging/webhooks) |
| `NOTION_TOKEN` | For notion brick | [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| `GITHUB_TOKEN` | For github brick | [github.com/settings/tokens](https://github.com/settings/tokens) |
| `E2B_API_KEY` | For code-executor | [e2b.dev](https://e2b.dev) — free tier |
| **Memory (Supabase — free)** | | |
| `SUPABASE_URL` | For memory/knowledge base | [supabase.com](https://supabase.com) |
| `SUPABASE_ANON_KEY` | For memory/knowledge base | From Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | For admin operations | From Supabase project settings |
| **Google Workspace (OAuth)** | | |
| `GOOGLE_CLIENT_ID` | For Google bricks | [console.cloud.google.com](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | For Google bricks | From Google Cloud Console |
| `GOOGLE_ACCESS_TOKEN` | For Google bricks | Obtained after OAuth flow |
| **Deployment** | | |
| `CRON_SECRET` | Optional | Protects `/api/cron` — run `openssl rand -hex 32` |
| `OWNER_EMAIL` | For email workflows | Your email for daily briefing etc. |
| `NEXT_PUBLIC_APP_URL` | In production | Your deployed URL, e.g. `https://agent.vercel.app` |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| AI | Vercel AI SDK v6 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Validation | Zod v4 |
| Database | Supabase (optional, for memory) |
| Deployment | Vercel (free tier) |
| Language | JavaScript (ES2022) |

---

## Project structure

```
agentkit/
├── agent.config.js          ← THE file. Configure everything here.
├── .env.example             ← copy to .env.local, fill in keys
├── AGENTS.md                ← instructions for AI coding assistants
│
├── app/                     ← Next.js App Router (no src/ directory)
│   ├── page.js              ← main chat page
│   ├── layout.js            ← root layout, fonts, theme
│   ├── loading.js           ← loading skeleton
│   ├── error.js             ← error boundary
│   ├── not-found.js         ← 404 page
│   ├── globals.css          ← Tailwind v4 + OKLCH design tokens
│   └── api/
│       ├── chat/route.js    ← streaming chat (main AI endpoint)
│       ├── tools/route.js   ← list active bricks
│       ├── workflow/route.js← trigger workflows on demand
│       ├── cron/route.js    ← Vercel cron → runs scheduled workflows
│       ├── memory/route.js  ← read/write long-term memory
│       ├── knowledge/route.js← upload docs into RAG knowledge base
│       └── registry/route.js← register agent on the dashboard
│
├── core/                    ← engine — edit with care
│   ├── agent.js             ← orchestrator, system prompt assembly
│   ├── model.js             ← provider-agnostic AI SDK adapter
│   ├── tool-runner.js       ← brick loader, validator, executor
│   ├── memory.js            ← three-tier memory (session/long/RAG)
│   ├── persona.js           ← built-in system prompt personas
│   └── workflow-runner.js   ← YAML workflow interpreter
│
├── bricks/
│   ├── tools/               ← 24 bricks, one file each — add yours here
│   ├── workflows/           ← YAML workflow definitions
│   └── personas/            ← custom persona files
│
├── components/
│   ├── chat/                ← ChatWindow, MessageBubble, ToolCallCard…
│   └── ui/                  ← ThemeToggle, ThemeProvider
│
├── hooks/
│   ├── useLocalStorage.js   ← persisted state hook
│   └── useTheme.js          ← theme toggle hook
│
├── lib/
│   ├── env.js               ← Zod-validated env, single source of truth
│   ├── supabase.js          ← shared Supabase client
│   ├── rate-limit.js        ← in-memory rate limiter
│   └── utils.js             ← cn(), generateId(), timeAgo()…
│
└── docs/
    ├── QUICKSTART.md        ← step-by-step setup for non-technical users
    ├── bricks.md            ← full brick reference
    └── supabase-setup.sql   ← run this in Supabase SQL editor
```

---

## Contributing

Contributions are welcome. The most valuable additions are new bricks.

1. Fork the repo
2. Create your brick in `bricks/tools/`
3. Test it locally
4. Open a PR with a short description of what it does and what API key it needs

---

## License

MIT — use freely, commercially or otherwise.

---

Built by [Smartly Ventures](https://smartly.ventures).
