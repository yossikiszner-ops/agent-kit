# Contributing to AgentKit

Thank you for wanting to contribute. The most valuable contributions are **new bricks** — each one expands what every fork of this repo can do.

---

## What we need most

1. **New bricks** — integrations with APIs that are widely useful (Slack, WhatsApp, Airtable, Linear, Stripe, etc.)
2. **Workflow examples** — real YAML workflows that solve common problems
3. **Bug fixes** — especially around tool execution and error handling
4. **Documentation improvements** — making setup clearer for non-technical users

---

## Adding a brick

### 1. Create the file

```bash
touch bricks/tools/my-service.js
```

### 2. Implement the Brick interface

```js
// bricks/tools/my-service.js
import * as z from "zod";

const brick = {
  // Unique snake-case name matching the filename
  name: "my-service",

  // The AI reads this description to decide when and how to call the tool.
  // Be specific: what it does, when to use it, what it returns.
  description:
    "Does X by calling the My Service API. Use when Y. Returns Z.",

  // List every env var this brick needs.
  // If any are missing, a clear error is shown at startup.
  requiredEnvVars: ["MY_SERVICE_API_KEY"],

  // Zod v4 schema for the tool's input parameters.
  // The AI model sees these descriptions — write them clearly.
  parameters: z.object({
    query: z
      .string()
      .min(1)
      .max(500)
      .describe("What to search for"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Max results (default 5)"),
  }),

  // The tool logic. Must return JSON-serialisable data.
  // Throw an Error on failure — the tool runner catches it and calls onError.
  execute: async ({ query, limit }) => {
    const res = await fetch(`https://api.myservice.com/search?q=${query}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${process.env.MY_SERVICE_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`My Service API returned ${res.status}`);
    }
    const data = await res.json();
    return { results: data.items };
  },

  // Friendly message returned to the AI when execute() throws.
  // Should help the AI tell the user what went wrong and what to try.
  onError: (err) =>
    `My Service failed: ${err.message}. Check MY_SERVICE_API_KEY in .env.local.`,
};

export default brick;
```

### 3. Document the brick

Add an entry to `docs/bricks.md` following the existing format:
- What env var(s) it needs
- Where to get a free API key
- What actions/capabilities it has
- Example prompts

### 4. Add the env var to `.env.example`

```bash
# ── Brick: My Service ─────────────────────────────────────────────────────────
# My Service API key → https://myservice.com/api-keys
MY_SERVICE_API_KEY=""
```

### 5. Test it locally

Enable the brick in `agent.config.js`:
```js
bricks: ["my-service"]
```

Start the dev server and test with prompts that should trigger the brick.

### 6. Open a PR

- Title: `feat(brick): add my-service brick`
- Description: what it does, what API it uses, free tier info, example prompts

---

## Code style

- JavaScript only — no TypeScript
- ES modules (`import`/`export`) — no `require()`
- `@/` paths from project root — no relative `../../` imports
- Zod v4 — import as `import * as z from "zod"`
- ESLint + Prettier — run `pnpm check` before pushing

The pre-commit hook runs `pnpm lint-staged` automatically.

---

## Running tests

```bash
pnpm lint        # ESLint check
pnpm format:check  # Prettier check
pnpm build       # Full Next.js build (catches import errors)
```

We don't have unit tests yet — PRs adding test coverage are very welcome.

---

## Reporting bugs

Open a GitHub issue with:
- What you expected
- What happened instead
- Your `agent.config.js` (redact any API keys)
- Node.js and pnpm versions (`node -v && pnpm -v`)
