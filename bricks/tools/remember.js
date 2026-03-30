/**
 * bricks/tools/remember.js — Store a fact in long-term memory
 *
 * Requires: Supabase (SUPABASE_URL + SUPABASE_ANON_KEY)
 * Works with the recall brick for semantic retrieval.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";
import { rememberFact } from "@/core/memory.js";

const brick = {
  name: "remember",
  description:
    "Store a piece of information in long-term memory for future conversations. " +
    "Use this when the user shares important facts about themselves, their preferences, " +
    "ongoing projects, or anything they'd want you to remember next time.",

  requiredEnvVars: ["SUPABASE_URL", "SUPABASE_ANON_KEY"],

  parameters: z.object({
    fact: z
      .string()
      .min(5)
      .max(2_000)
      .describe(
        "The fact to remember, written as a clear statement. " +
          "E.g. 'The user's name is Priya' or 'User prefers concise responses'."
      ),
    category: z
      .enum([
        "preference",
        "personal",
        "project",
        "fact",
        "instruction",
        "other",
      ])
      .optional()
      .default("fact")
      .describe("Category of the memory for better organisation"),
    userId: z
      .string()
      .optional()
      .default("anonymous")
      .describe("User identifier — passed automatically by the agent"),
  }),

  execute: async ({ fact, category = "fact", userId = "anonymous" }) => {
    const entry = await rememberFact(userId, fact, { category });

    return {
      success: true,
      remembered: fact,
      category,
      id: entry?.id,
      message: `I'll remember that: "${fact}"`,
    };
  },

  onError: (err) =>
    `Could not save to memory: ${err.message}. Make sure Supabase is configured.`,
};

export default brick;
