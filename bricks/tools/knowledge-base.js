/**
 * bricks/tools/knowledge-base.js — Search your own knowledge base
 *
 * Requires: Supabase with pgvector extension enabled
 * Set memory.knowledgeBase: true in agent.config.js
 *
 * Upload documents via POST /api/knowledge
 * The agent uses this brick to answer questions from your uploaded content.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";
import { searchKnowledgeBase } from "@/core/memory.js";

const brick = {
  name: "knowledge-base",
  description:
    "Search the agent's private knowledge base for information from uploaded documents. " +
    "Use this FIRST before web search when the user's question may be answered by " +
    "the documents you've been given. Returns the most relevant passages.",

  requiredEnvVars: ["SUPABASE_URL", "SUPABASE_ANON_KEY"],

  parameters: z.object({
    query: z
      .string()
      .min(3)
      .max(500)
      .describe("The question or topic to search the knowledge base for"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(4)
      .describe("Number of relevant passages to return (default 4)"),
  }),

  execute: async ({ query, limit = 4 }) => {
    const results = await searchKnowledgeBase(query, limit);

    if (!results.length) {
      return {
        found: false,
        results: [],
        message:
          "No relevant content found in the knowledge base for this query. " +
          "Try rephrasing or use web-search for general information.",
      };
    }

    return {
      found: true,
      count: results.length,
      results: results.map((r) => ({
        content: r.content,
        source: r.source,
        relevance: Math.round(r.score * 100) + "%",
      })),
    };
  },

  onError: (err) =>
    `Knowledge base search failed: ${err.message}. Ensure Supabase is configured and documents have been uploaded.`,
};

export default brick;
