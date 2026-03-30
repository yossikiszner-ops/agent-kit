# AGENTS.md — AgentKit

Instructions for AI coding assistants working in this repository.

## Project overview

AgentKit is a modular AI agent template built on Next.js 16 (App Router, JavaScript).
The goal: fork → configure → deploy. One config file controls everything.

## Structure

```
agentkit/
├── agent.config.js   ← THE config file. Most changes go here.
├── app/              ← Next.js App Router (no src/ directory)
│   ├── api/          ← API routes
│   ├── globals.css   ← Tailwind v4 CSS-first config
│   ├── layout.js     ← Root layout
│   └── page.js       ← Main chat page
├── core/             ← Engine files — edit carefully
├── bricks/
│   ├── tools/        ← One file per tool — safe to add files here
│   └── workflows/    ← YAML workflow definitions
├── components/       ← React components (.jsx)
├── lib/              ← Utilities
└── hooks/            ← React hooks
```

## Critical rules

1. **No TypeScript.** All files are `.js` or `.jsx`. Do not create `.ts` or `.tsx` files.
2. **No `src/` directory.** `app/`, `core/`, `lib/`, etc. all live at the project root.
3. **`@/` maps to the project root.** `@/lib/env.js` = `./lib/env.js`. Never use `@/src/`.
4. **No `require()`.** Use `import` (static) or `await import()` (dynamic) only.
5. **Tailwind v4.** No `tailwind.config.js`. All config is in `app/globals.css` via `@theme`.
6. **Zod v4.** Import as `import * as z from "zod"` (not `import { z }`).
7. **AI SDK v6.** Use `streamText`, `generateText`, `embed` from `"ai"`. Model via `getModel()`.
8. **ESLint 10 flat config.** Config is in `eslint.config.mjs`. No `.eslintrc.*` files.

## Adding a brick (tool)

Create `bricks/tools/my-brick.js` exporting this exact shape:

```js
import * as z from "zod";
const brick = {
  name: "my-brick",
  description: "Clear description of what this tool does and when to use it.",
  requiredEnvVars: ["MY_API_KEY"],          // optional
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => ({ result: "..." }),
  onError: (err) => `Tool failed: ${err.message}`,
};
export default brick;
```

Then add `"my-brick"` to `bricks[]` in `agent.config.js`. No other changes needed.

## Env vars

- **Never** access `process.env` directly in app code. Import from `@/lib/env.js`.
- `serverEnv` — server-only (API keys). `clientEnv` / `agentIdentity` — safe everywhere.
- Adding a new var: add to `.env.example`, add to the Zod schema in `lib/env.js`.

## API routes

All routes live in `app/api/*/route.js`. Pattern:
1. Rate limit with `rateLimit(ip)` from `@/lib/rate-limit.js`
2. Parse body with `z.object({...}).safeParse(raw)`
3. Return `NextResponse.json(data)` or `result.toDataStreamResponse()` for streaming

## Components

- **Server Components** by default. Add `"use client"` only when needed (event handlers, hooks).
- UI components go in `components/`. Chat-specific in `components/chat/`.
- Use `cn()` from `@/lib/utils.js` for conditional Tailwind classes.

## Common mistakes to avoid

- Do NOT create `tailwind.config.js` — Tailwind v4 uses CSS-first config
- Do NOT use `tailwindcss-animate` — use `tw-animate-css` instead
- Do NOT use `React.forwardRef` — removed in React 19
- Do NOT use `middleware.ts` — renamed to `proxy.ts` in Next.js 16
- Do NOT install `@types/*` packages — this is a JS project
- Do NOT put files inside `src/` — there is no src directory
