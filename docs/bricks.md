# Brick Reference

Every brick available in AgentKit. Enable any brick by adding its name to `bricks[]` in `agent.config.js`.

---

## Free bricks (no API key needed)

### `calculator`

Evaluates mathematical expressions and performs unit conversions.

```js
bricks: ["calculator"]
```

**Capabilities:** Arithmetic, percentages, exponents, unit conversions (km/miles, kg/lbs, °C/°F, and more).

**Example prompts:**
- "What's 18% tip on ₹2,340?"
- "Convert 5 miles to km"
- "What's (144 / 12) ^ 2?"

---

### `date-time`

Date and time utilities using the built-in Intl API.

```js
bricks: ["date-time"]
```

**Capabilities:** Current date/time in any timezone, timezone conversion, duration between dates, add/subtract time, format dates.

**Example prompts:**
- "What time is it in New York right now?"
- "How many days until April 15?"
- "What date is 90 days from today?"

---

### `text-utils`

Text analysis without any external API.

```js
bricks: ["text-utils"]
```

**Capabilities:** Word/character/sentence count, keyword extraction, language detection, readability score, clean HTML from text, generate URL slugs.

**Example prompts:**
- "How many words is this article?" (then paste text)
- "What are the main keywords in this text?"
- "What reading level is this paragraph?"

---

### `weather`

Current weather and forecasts via Open-Meteo (completely free, no signup).

```js
bricks: ["weather"]
```

**Capabilities:** Current conditions, 7-day forecast, any city worldwide, Celsius or Fahrenheit.

**Example prompts:**
- "What's the weather in Mumbai?"
- "Will it rain in Nagpur this week?"
- "Current temperature in London in Fahrenheit"

---

### `web-scraper`

Reads any public web page as clean text.

```js
bricks: ["web-scraper"]
```

**Capabilities:** Extracts text content from any URL, strips HTML, returns title and links.

**Example prompts:**
- "Read this article: https://example.com/article"
- "What does this page say? [URL]"

---

### `http-request`

Makes calls to any REST API.

```js
bricks: ["http-request"]
```

**Capabilities:** GET, POST, PUT, PATCH, DELETE. Pass headers and body. Returns parsed JSON or text.

**Example prompts:**
- "Call the GitHub API to get my repos"
- "Make a POST request to https://api.example.com/data with body { name: 'test' }"

---

## Bricks requiring free API keys

### `web-search`

Real-time web search via Tavily.

```
TAVILY_API_KEY=tvly-...
```

Get free key (1000 searches/month): [tavily.com](https://tavily.com)

```js
bricks: ["web-search"]
```

**Capabilities:** Searches the live web, returns answer + top results with snippets and URLs.

---

### `deep-research`

Multi-angle research pipeline — runs several searches, reads key sources, returns structured findings.

```
TAVILY_API_KEY=tvly-...
```

```js
bricks: ["deep-research"]
```

**Capabilities:** Runs 2–6 searches from different angles, scrapes top sources in "deep" mode, returns deduplicated results sorted by relevance.

**Slower than `web-search` but much more thorough.**

---

### `email-send`

Sends emails via Resend.

```
RESEND_API_KEY=re_...
EMAIL_FROM=agent@yourdomain.com
```

Get free key (3000 emails/month): [resend.com](https://resend.com)

```js
bricks: ["email-send"]
```

**Capabilities:** Send to one or multiple recipients, plain text or HTML, optional reply-to.

---

### `telegram-send`

Sends messages to Telegram chats.

```
TELEGRAM_BOT_TOKEN=123456:ABC...
```

Create a bot via [@BotFather](https://t.me/BotFather) on Telegram.

```js
bricks: ["telegram-send"]
```

**Capabilities:** Send text messages with Markdown formatting, disable link previews.

**Getting your chat ID:** Message [@userinfobot](https://t.me/userinfobot) on Telegram.

---

## Memory bricks (requires Supabase)

Set up Supabase first: run `docs/supabase-setup.sql` in your project's SQL editor.

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Also set in `agent.config.js`:
```js
memory: { longTerm: true }
```

### `remember`

Stores a fact about the user in long-term memory.

```js
bricks: ["remember"]
```

**Example:** "Remember that I prefer concise answers and I'm working on a SaaS product."

### `recall`

Retrieves memories relevant to the current conversation.

```js
bricks: ["recall"]
```

**Example:** "What do you remember about me?"

---

## Productivity bricks

### `notion`

Reads and writes Notion pages and databases.

```
NOTION_TOKEN=secret_...
```

Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations), then share the target pages with it.

```js
bricks: ["notion"]
```

**Actions:** `search`, `get-page`, `create-page`, `append-block`, `query-database`

---

### `github`

Manages GitHub issues, PRs, and repos.

```
GITHUB_TOKEN=ghp_...
```

Create a token at [github.com/settings/tokens](https://github.com/settings/tokens). Minimum scope: `repo`.

```js
bricks: ["github"]
```

**Actions:** `list-issues`, `get-issue`, `create-issue`, `list-prs`, `get-pr`, `get-file`, `list-repos`, `search-code`

---

## Google Workspace bricks

All Google bricks require OAuth. Set up in Google Cloud Console:
1. Create a project and enable the relevant APIs (Gmail API, Calendar API, Sheets API)
2. Create OAuth 2.0 credentials
3. Add credentials to `.env.local`

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_ACCESS_TOKEN=...   # from completing the OAuth flow
```

### `gmail-reader`

Reads and searches Gmail.

```js
bricks: ["gmail-reader"]
```

**Actions:** `search`, `list`, `read`, `get-labels`

Supports Gmail search syntax: `from:`, `subject:`, `is:unread`, `after:`, `has:attachment`, etc.

---

### `google-calendar`

Reads and creates calendar events.

```js
bricks: ["google-calendar"]
```

**Actions:** `list-events`, `get-event`, `create-event`, `list-calendars`

---

### `google-sheets`

Reads and writes Google Sheets.

```js
bricks: ["google-sheets"]
```

**Actions:** `read-range`, `write-range`, `append-rows`, `get-sheets`, `clear-range`

Uses A1 notation: `Sheet1!A1:D10`

---

## Writing your own brick

Create `bricks/tools/my-brick.js`:

```js
import * as z from "zod";

const brick = {
  name: "my-brick",

  // The AI reads this to decide when to call the tool — be specific
  description: "Does X when Y. Use when Z.",

  // Env vars required — clear error shown at startup if missing
  requiredEnvVars: ["MY_API_KEY"],

  // Zod schema for the tool's input
  parameters: z.object({
    query: z.string().describe("What to look up"),
    limit: z.number().int().min(1).max(10).optional().default(5),
  }),

  // The tool logic — return JSON-serialisable data
  execute: async ({ query, limit }) => {
    const data = await myApi.search(query, limit);
    return { results: data };
  },

  // Friendly error message returned to the AI on failure
  onError: (err) => `My tool failed: ${err.message}. Try again.`,
};

export default brick;
```

Then add `"my-brick"` to `bricks[]` in `agent.config.js`.

**That's it.** The tool runner discovers it automatically.

---

### `rss-reader`

Reads and parses any RSS or Atom feed — no API key needed.

```js
bricks: ["rss-reader"]
```

**Capabilities:** Fetch any public RSS/Atom feed, return items with title, link, date, author, snippet or full content.

**Example prompts:**
- "What's the latest from https://hnrss.org/frontpage?"
- "Read the BBC News feed and summarise the top 5 stories"
- "Check for new GitHub releases from the Next.js repo"

---

### `slack-send`

Sends messages to Slack channels.

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
# or
SLACK_BOT_TOKEN=xoxb-...
```

Webhook (simplest): [api.slack.com/messaging/webhooks](https://api.slack.com/messaging/webhooks)
Bot token: [api.slack.com/apps](https://api.slack.com/apps)

```js
bricks: ["slack-send"]
```

---

### `gmail-sender`

Sends emails from the user's Gmail account via OAuth.

```
GOOGLE_ACCESS_TOKEN=ya29...
```

Complete the Google OAuth flow at `/api/auth/google` to obtain this token.

```js
bricks: ["gmail-sender"]
```

**Actions:** Compose and send emails, support for CC, reply threading.

---

### `google-docs`

Read, create, and edit Google Docs documents.

```
GOOGLE_ACCESS_TOKEN=ya29...
```

```js
bricks: ["google-docs"]
```

**Actions:** `read` (get content), `create` (new document with optional body), `append` (add text to end), `replace` (find and replace text)

---

### `google-drive`

Search and access files in Google Drive.

```
GOOGLE_ACCESS_TOKEN=ya29...
```

```js
bricks: ["google-drive"]
```

**Actions:** `search`, `list` (recent files), `get-file` (read text files, Google Docs, Sheets as text), `list-folders`

---

### `knowledge-base`

Semantic search over documents you've uploaded to the agent's knowledge base.

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

Also requires: `memory.knowledgeBase: true` in `agent.config.js`.

Upload documents via `POST /api/knowledge` with `{ content, source }`.

```js
bricks: ["knowledge-base"]
```

---

### `code-executor`

Runs JavaScript or Python code in a secure E2B sandbox.

```
E2B_API_KEY=e2b_...
```

Free tier at [e2b.dev](https://e2b.dev).

```js
bricks: ["code-executor"]
```

**Capabilities:** Execute JS or Python, access numpy/pandas/axios, configurable timeout up to 30 seconds. Returns stdout, stderr, and exit code.

