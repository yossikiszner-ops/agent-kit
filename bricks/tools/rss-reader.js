/**
 * bricks/tools/rss-reader.js — RSS/Atom feed reader
 *
 * No API key required. Fetches and parses any public RSS or Atom feed.
 * Great for monitoring news sources, blogs, podcasts, and changelogs.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "rss-reader",
  description:
    "Fetch and read RSS or Atom feeds from any URL. " +
    "Use to monitor blogs, news sources, podcasts, GitHub releases, " +
    "or any site that publishes an RSS feed. " +
    "Returns the latest items with titles, summaries, links, and dates.",

  parameters: z.object({
    url: z
      .string()
      .url()
      .describe(
        "The RSS or Atom feed URL. " +
          "Examples: https://feeds.bbci.co.uk/news/rss.xml, " +
          "https://github.com/vercel/next.js/releases.atom"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Maximum number of items to return (default 10)"),
    includeContent: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Include full content/description of each item (can be very long)"
      ),
  }),

  execute: async ({ url, limit = 10, includeContent = false }) => {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "AgentKit/1.0 RSS Reader",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        error: `Failed to fetch feed: HTTP ${res.status} ${res.statusText}`,
      };
    }

    const xml = await res.text();
    const isAtom = xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"");

    let feed;
    if (isAtom) {
      feed = parseAtom(xml, limit, includeContent);
    } else {
      feed = parseRss(xml, limit, includeContent);
    }

    return {
      feedTitle: feed.title,
      feedUrl: url,
      feedFormat: isAtom ? "Atom" : "RSS",
      itemCount: feed.items.length,
      items: feed.items,
      lastUpdated: feed.lastUpdated ?? null,
    };
  },

  onError: (err) =>
    `RSS feed failed: ${err.message}. Check the URL is a valid RSS or Atom feed.`,
};

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * @param {string} xml
 * @param {number} limit
 * @param {boolean} includeContent
 */
function parseRss(xml, limit, includeContent) {
  const title = extractTag(xml, "title") ?? "Unknown Feed";
  const lastUpdated = extractTag(xml, "lastBuildDate") ?? extractTag(xml, "pubDate");

  // Extract all <item> blocks
  const itemBlocks = extractAll(xml, "item");

  const items = itemBlocks.slice(0, limit).map((block) => {
    const item = {
      title: decodeHtmlEntities(extractTag(block, "title") ?? "No title"),
      link: extractTag(block, "link") ?? extractAttr(block, "link", "href"),
      pubDate: extractTag(block, "pubDate") ?? extractTag(block, "dc:date"),
      author: extractTag(block, "author") ?? extractTag(block, "dc:creator"),
      categories: extractAllTags(block, "category"),
    };

    if (includeContent) {
      const desc = extractTag(block, "description") ?? extractTag(block, "content:encoded");
      item.description = desc
        ? decodeHtmlEntities(stripHtml(desc)).slice(0, 1_000)
        : null;
    } else {
      // Short snippet only
      const desc = extractTag(block, "description") ?? "";
      item.snippet = decodeHtmlEntities(stripHtml(desc)).slice(0, 200);
    }

    return item;
  });

  return { title: decodeHtmlEntities(title), items, lastUpdated };
}

/**
 * @param {string} xml
 * @param {number} limit
 * @param {boolean} includeContent
 */
function parseAtom(xml, limit, includeContent) {
  const title = extractTag(xml, "title") ?? "Unknown Feed";
  const lastUpdated = extractTag(xml, "updated");

  const entryBlocks = extractAll(xml, "entry");

  const items = entryBlocks.slice(0, limit).map((block) => {
    const item = {
      title: decodeHtmlEntities(extractTag(block, "title") ?? "No title"),
      link: extractAttr(block, "link", "href") ?? extractTag(block, "id"),
      pubDate: extractTag(block, "published") ?? extractTag(block, "updated"),
      author: extractTag(block, "name"), // inside <author><name>
      categories: extractAllAttrs(block, "category", "term"),
    };

    if (includeContent) {
      const content = extractTag(block, "content") ?? extractTag(block, "summary");
      item.description = content
        ? decodeHtmlEntities(stripHtml(content)).slice(0, 1_000)
        : null;
    } else {
      const summary = extractTag(block, "summary") ?? extractTag(block, "content") ?? "";
      item.snippet = decodeHtmlEntities(stripHtml(summary)).slice(0, 200);
    }

    return item;
  });

  return { title: decodeHtmlEntities(title), items, lastUpdated };
}

// ─── XML helpers (no external deps) ──────────────────────────────────────────

/** Extract first match of a tag's inner text */
function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

/** Extract all inner texts of a tag */
function extractAllTags(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

/** Extract a specific attribute value from the first matching tag */
function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["'][^>]*>`, "i");
  const match = xml.match(re);
  return match ? match[1] : null;
}

/** Extract all values of a specific attribute from all matching tags */
function extractAllAttrs(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["'][^>]*>`, "gi");
  const results = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/** Extract all blocks between opening and closing tags */
function extractAll(xml, tag) {
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) ?? [];
}

/** Strip HTML tags from a string */
function stripHtml(html) {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Decode common HTML entities */
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export default brick;
