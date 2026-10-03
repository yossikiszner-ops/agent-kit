# WhatsApp Third-Party Agent — quick deploy

This branch exposes AgentKit as an external Gemini agent and an A2A-compatible endpoint.

## 1. Deploy to Vercel
Import this repository and select branch `whatsapp-agent`.

Add these environment variables:

- `AI_PROVIDER=gemini`
- `AI_MODEL=gemini-2.5-flash` (you may replace this with another Gemini model available to your key)
- `GOOGLE_GENERATIVE_AI_API_KEY=...`
- `NEXT_PUBLIC_AGENT_NAME=...`
- `NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app`

Optional: add `TAVILY_API_KEY` for web search and Supabase variables for long-term memory/RAG.

## 2. Endpoints

- Agent Card: `https://YOUR-PROJECT.vercel.app/.well-known/agent-card.json`
- Legacy discovery alias: `https://YOUR-PROJECT.vercel.app/.well-known/agent.json`
- A2A JSON-RPC: `https://YOUR-PROJECT.vercel.app/api/a2a`
- Simple JSON agent endpoint: `https://YOUR-PROJECT.vercel.app/api/agent`

## 3. WhatsApp

WhatsApp's new Third-Party Agents feature generates a connection/API key inside WhatsApp. The current public Help Center says that key is entered into the external platform hosting the agent. Because Meta's developer manual for this limited rollout is not publicly indexable in a stable form yet, do not put that key into a public repository.

Deploy first. Then use the connection screen shown by your WhatsApp build to supply the deployed agent URL and/or key as requested. If your build provides a specific callback URL, header name, or handshake format, implement that exact contract rather than guessing it.

## Test before WhatsApp

GET `/api/agent` should return `{ ok: true }`.
POST `/api/agent` with `{ "message": "hello" }` should return a Gemini response.
