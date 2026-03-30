/**
 * bricks/tools/recall.js — Retrieve relevant long-term memories
 *
 * Requires: Supabase with pgvector
 * Pair with the remember brick.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";
import { recallMemories } from "@/core/memory.js";

const brick = {
  name: "recall",
  description:
    "Search long-term memory for information relevant to a query. " +
    "Use this when you need to remember something about the user or a previous conversation. " +
    "Returns the most semantically similar stored facts.",

  requiredEnvVars: ["SUPABASE_URL", "SUPABASE_ANON_KEY"],

  parameters: z.object({
    query: z
      .string()
      .min(3)
      .max(500)
      .describe("What to look for in memory. Be specific."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe("Max number of memories to retrieve"),
    userId: z
      .string()
      .optional()
      .default("anonymous")
      .describe("User identifier — passed automatically by the agent"),
  }),

  execute: async ({ query, limit = 5, userId = "anonymous" }) => {
    const memories = await recallMemories(userId, query, limit);

    if (memories.length === 0) {
      return {
        found: false,
        memories: [],
        message: "No relevant memories found for this query.",
      };
    }

    return {
      found: true,
      count: memories.length,
      memories: memories.map((m) => ({
        content: m.content,
        score: Math.round((m.score ?? 0) * 100) / 100,
        category: m.metadata?.category ?? "unknown",
        savedAt: m.createdAt?.toISOString(),
      })),
    };
  },

  onError: (err) => `Memory recall failed: ${err.message}`,
};

export default brick;
