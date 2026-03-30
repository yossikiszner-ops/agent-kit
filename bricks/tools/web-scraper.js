/**
 * bricks/tools/web-scraper.js — Extract clean text from any URL
 *
 * No API key required. Fetches the page and strips HTML.
 * Respects robots.txt semantics by not storing or republishing content.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "web-scraper",
  description:
    "Read and extract the text content of any public web page. " +
    "Use this when you have a specific URL to read — for general searches use web-search instead. " +
    "Returns the page title, main text content, and any links found.",

  parameters: z.object({
    url: z
      .string()
      .url()
      .describe("The full URL of the page to read, including https://"),
    maxLength: z
      .number()
      .int()
      .min(100)
      .max(20_000)
      .optional()
      .default(5_000)
      .describe("Max characters of text to return (default 5000)"),
  }),

  execute: async ({ url, maxLength = 5_000 }) => {
    // Validate URL scheme — only allow http/https
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "Only http and https URLs are supported." };
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "AgentKit/1.0 (+https://github.com/smartly-ventures/agentkit)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    if (!response.ok) {
      return {
        error: `Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return {
        error: `Cannot read this file type: ${contentType}. Only HTML and plain text are supported.`,
      };
    }

    const html = await response.text();

    // Strip scripts, styles, and HTML tags
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : parsed.hostname;

    // Extract links
    const linkRe = /href="(https?:\/\/[^"]{5,200})"/g;
    const links = [];
    let m;
    while ((m = linkRe.exec(html)) !== null && links.length < 10) {
      if (!links.includes(m[1])) {
        links.push(m[1]);
      }
    }

    return {
      url,
      title,
      content: cleaned.slice(0, maxLength),
      contentLength: cleaned.length,
      truncated: cleaned.length > maxLength,
      links,
    };
  },

  onError: (err) => `Could not read that URL: ${err.message}`,
};

export default brick;
