/**
 * bricks/tools/web-search.js — Real-time web search via Tavily
 *
 * Requires: TAVILY_API_KEY in .env.local
 * Free tier: 1000 searches/month → https://tavily.com
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "web-search",
  description:
    "Search the web for current information. Use this for: recent news, " +
    "real-time data, facts that may have changed, anything you're uncertain about. " +
    "Returns the top results with titles, snippets, and URLs.",

  requiredEnvVars: ["TAVILY_API_KEY"],

  parameters: z.object({
    query: z
      .string()
      .min(2)
      .max(400)
      .describe("The search query. Be specific for better results."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("Number of results to return (default 5, max 10)"),
    searchDepth: z
      .enum(["basic", "advanced"])
      .optional()
      .default("basic")
      .describe(
        "'basic' is faster and cheaper. 'advanced' searches deeper and is more thorough."
      ),
  }),

  execute: async ({ query, maxResults = 5, searchDepth = "basic" }) => {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Tavily API error ${response.status}: ${text}`);
    }

    const data = await response.json();

    return {
      answer: data.answer ?? null,
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 500) ?? "",
        score: r.score,
      })),
      query,
    };
  },

  onError: (err) =>
    `Web search failed: ${err.message}. Try rephrasing the query or checking TAVILY_API_KEY.`,
};

export default brick;
