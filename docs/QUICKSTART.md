# AgentKit Quick Start Guide

You'll have a live AI agent in about 15 minutes. No coding required.

---

## Step 1 — Get a free AI API key

AgentKit defaults to Google Gemini which has a generous free tier.

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API key** → **Create API key**
4. Copy the key — you'll need it in Step 4

---

## Step 2 — Fork the repo

1. Go to [github.com/smartly-ventures/agentkit](https://github.com/smartly-ventures/agentkit)
2. Click the **Fork** button (top right)
3. Click **Create fork** — this creates your own copy

---

## Step 3 — Deploy to Vercel (free)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Find and import your forked `agentkit` repo
4. Click **Deploy** — Vercel will detect it as a Next.js project automatically

Your first deploy will fail because the API key isn't set yet. That's fine — continue to Step 4.

---

## Step 4 — Add your environment variables

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add these variables:

| Name | Value |
|------|-------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your key from Step 1 |
| `NEXT_PUBLIC_AGENT_NAME` | Your agent's name, e.g. `Aria` |
| `NEXT_PUBLIC_AGENT_COLOR` | A hex colour, e.g. `#0F6E56` |
| `NEXT_PUBLIC_AGENT_WELCOME` | Opening message, e.g. `Hi! How can I help?` |

3. Click **Save** after adding each one

---

## Step 5 — Redeploy

1. Go to **Deployments** in Vercel
2. Click the three dots next to your latest deployment
3. Click **Redeploy**

Your agent is now live at `https://your-project.vercel.app` 🎉

---

## Customise your agent

Edit `agent.config.js` in your GitHub fork. The most useful things to change:

### Change the persona

```js
persona: "researcher",  // assistant | researcher | coder | tutor | sales | support
```

### Add suggested prompts

```js
ui: {
  suggestedPrompts: [
    "Summarise the latest AI news",
    "Help me write an email",
    "What's the weather in Mumbai?",
  ],
}
```

### Enable more tools (bricks)

Uncomment lines in the `bricks` array:

```js
bricks: [
  "calculator",
  "date-time",
  "web-search",    // needs TAVILY_API_KEY
  "weather",       // free, no key needed
],
```

After editing, commit the change on GitHub — Vercel redeploys automatically.

---

## Enable web search (free)

1. Go to [tavily.com](https://tavily.com) and sign up
2. Copy your API key
3. In Vercel → Settings → Environment Variables, add:
   - `TAVILY_API_KEY` = your key
4. In `agent.config.js`, uncomment `"web-search"` in the bricks array
5. Redeploy

---

## Enable long-term memory (free)

Your agent can remember things about users between conversations.

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **Extensions** and enable **vector**
3. Go to **SQL Editor** and run the contents of `docs/supabase-setup.sql`
4. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
5. Add all three to Vercel environment variables
6. In `agent.config.js`, set `memory: { longTerm: true }`
7. Enable the `"remember"` and `"recall"` bricks

---

## Change the AI model

To use GPT-4o instead of Gemini:

1. Get an OpenAI API key at [platform.openai.com](https://platform.openai.com)
2. Add `OPENAI_API_KEY` in Vercel
3. In `agent.config.js`:

```js
model: {
  provider: "openai",
  model: "gpt-4o-mini",  // or "gpt-4o" for the most capable
}
```

---

## Running locally

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/agentkit.git
cd agentkit

# Install dependencies (requires Node 22+ and pnpm)
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Need help?

- Full brick reference: [docs/bricks.md](./bricks.md)
- GitHub issues: [github.com/smartly-ventures/agentkit/issues](https://github.com/smartly-ventures/agentkit/issues)
- All environment variables: [`.env.example`](../.env.example)
