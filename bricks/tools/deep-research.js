/**
 * bricks/tools/deep-research.js — Multi-step research pipeline
 *
 * Requires: TAVILY_API_KEY
 * Runs multiple targeted searches, scrapes key sources,
 * and returns structured findings ready for synthesis.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "deep-research",
  description:
    "Conduct thorough multi-angle research on a topic. " +
    "Runs multiple searches, reads key sources, and returns structured findings. " +
    "Use for in-depth questions where a single search isn't enough. " +
    "Slower than web-search but much more comprehensive.",

  requiredEnvVars: ["TAVILY_API_KEY"],

  parameters: z.object({
    topic: z
      .string()
      .min(5)
      .max(500)
      .describe("The topic or question to research thoroughly"),
    depth: z
      .enum(["quick", "standard", "deep"])
      .optional()
      .default("standard")
      .describe(
        "quick=2 searches, standard=4 searches, deep=6 searches + page reading"
      ),
  }),

  execute: async ({ topic, depth = "standard" }) => {
    const searchCounts = { quick: 2, standard: 4, deep: 6 };
    const numSearches = searchCounts[depth];

    // Generate search angles (different perspectives on the topic)
    const angles = generateSearchAngles(topic, numSearches);
    const allResults = [];

    // Run searches in parallel for speed
    const searchPromises = angles.map((query) =>
      searchTavily(query, depth === "deep" ? "advanced" : "basic")
    );
    const searchResults = await Promise.allSettled(searchPromises);

    for (const result of searchResults) {
      if (result.status === "fulfilled" && result.value) {
        allResults.push(...result.value);
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    const unique = allResults.filter((r) => {
      if (seen.has(r.url)) {
        return false;
      }
      seen.add(r.url);
      return true;
    });

    // Sort by relevance score
    unique.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top = unique.slice(0, 10);

    // For deep mode: read the top 2 pages fully
    const pageContent = [];
    if (depth === "deep" && top.length > 0) {
      const toRead = top.slice(0, 2);
      const readPromises = toRead.map((r) =>
        readPage(r.url).catch(() => null)
      );
      const pages = await Promise.allSettled(readPromises);
      for (const p of pages) {
        if (p.status === "fulfilled" && p.value) {
          pageContent.push(p.value);
        }
      }
    }

    return {
      topic,
      depth,
      searchesRun: angles.length,
      results: top,
      pageContent,
      sources: top.map((r) => r.url),
      summary: `Found ${unique.length} unique sources across ${angles.length} searches.`,
    };
  },

  onError: (err) => `Deep research failed: ${err.message}`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** @param {string} topic @param {number} count @returns {string[]} */
function generateSearchAngles(topic, count) {
  const angles = [
    topic,
    `${topic} overview explained`,
    `${topic} latest developments 2026`,
    `${topic} examples case studies`,
    `${topic} pros cons challenges`,
    `${topic} expert opinion analysis`,
  ];
  return angles.slice(0, count);
}

/** @param {string} query @param {string} depth @returns {Promise<any[]>} */
async function searchTavily(query, depth = "basic") {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: 5,
      search_depth: depth,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content?.slice(0, 300) ?? "",
    score: r.score ?? 0,
  }));
}

/** @param {string} url @returns {Promise<{ url: string, title: string, content: string } | null>} */
async function readPage(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AgentKit/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return null;
    }
    const html = await res.text();
    const title =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? url;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 3_000);
    return { url, title, content: text };
  } catch {
    return null;
  }
}

export default brick;
