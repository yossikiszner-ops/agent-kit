/**
 * bricks/tools/notion.js — Notion integration
 *
 * Requires: NOTION_TOKEN in .env.local
 * Create an integration at https://notion.so/my-integrations (free).
 * Then share your pages/databases with the integration.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const NOTION_VERSION = "2022-06-28";

const brick = {
  name: "notion",
  description:
    "Read, search, create, and update Notion pages and databases. " +
    "Use for: reading notes, creating documents, querying databases, appending content. " +
    "Requires a Notion integration token and the target pages shared with that integration.",

  requiredEnvVars: ["NOTION_TOKEN"],

  parameters: z.object({
    action: z
      .enum(["search", "get-page", "create-page", "append-block", "query-database"])
      .describe(
        "search=find pages by title, get-page=read a page's content, " +
          "create-page=make a new page, append-block=add content to existing page, " +
          "query-database=list items from a database"
      ),
    query: z
      .string()
      .optional()
      .describe("Search query. Used by 'search'."),
    pageId: z
      .string()
      .optional()
      .describe("Notion page or block ID. Used by 'get-page' and 'append-block'."),
    databaseId: z
      .string()
      .optional()
      .describe("Notion database ID. Used by 'query-database' and 'create-page' (as parent)."),
    title: z
      .string()
      .optional()
      .describe("Page title. Used by 'create-page'."),
    content: z
      .string()
      .optional()
      .describe(
        "Page/block content as plain text or Markdown. Used by 'create-page' and 'append-block'."
      ),
    filter: z
      .record(z.unknown())
      .optional()
      .describe("Notion filter object. Used by 'query-database'."),
  }),

  execute: async ({
    action,
    query,
    pageId,
    databaseId,
    title,
    content,
    filter,
  }) => {
    const headers = {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    };

    switch (action) {
      case "search": {
        const res = await notionFetch("/search", "POST", headers, {
          query: query ?? "",
          sort: { direction: "descending", timestamp: "last_edited_time" },
          page_size: 10,
        });
        return {
          results: res.results.map((r) => ({
            id: r.id,
            type: r.object,
            title: extractTitle(r),
            url: r.url,
            lastEdited: r.last_edited_time,
          })),
        };
      }

      case "get-page": {
        if (!pageId) {
          return { error: "Provide pageId to get-page." };
        }
        const [page, blocks] = await Promise.all([
          notionFetch(`/pages/${pageId}`, "GET", headers),
          notionFetch(`/blocks/${pageId}/children?page_size=50`, "GET", headers),
        ]);
        return {
          id: page.id,
          title: extractTitle(page),
          url: page.url,
          lastEdited: page.last_edited_time,
          content: extractTextFromBlocks(blocks.results ?? []),
        };
      }

      case "create-page": {
        if (!title) {
          return { error: "Provide a title for the new page." };
        }
        const parent = databaseId
          ? { database_id: databaseId }
          : { page_id: pageId ?? "" };

        const children = content ? markdownToBlocks(content) : [];
        const res = await notionFetch("/pages", "POST", headers, {
          parent,
          properties: {
            title: [{ text: { content: title } }],
          },
          children,
        });
        return { id: res.id, url: res.url, title };
      }

      case "append-block": {
        if (!pageId || !content) {
          return { error: "Provide pageId and content to append-block." };
        }
        const blocks = markdownToBlocks(content);
        const res = await notionFetch(
          `/blocks/${pageId}/children`,
          "PATCH",
          headers,
          { children: blocks }
        );
        return { success: true, appended: res.results?.length ?? 0 };
      }

      case "query-database": {
        if (!databaseId) {
          return { error: "Provide databaseId to query-database." };
        }
        const res = await notionFetch(
          `/databases/${databaseId}/query`,
          "POST",
          headers,
          { filter, page_size: 20 }
        );
        return {
          count: res.results?.length ?? 0,
          results: (res.results ?? []).map((r) => ({
            id: r.id,
            title: extractTitle(r),
            url: r.url,
            properties: simplifyProperties(r.properties),
          })),
        };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) =>
    `Notion error: ${err.message}. Make sure NOTION_TOKEN is set and the page is shared with your integration.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function notionFetch(path, method, headers, body) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function extractTitle(page) {
  const props = page.properties ?? {};
  for (const p of Object.values(props)) {
    if (p.type === "title" && p.title?.[0]?.plain_text) {
      return p.title[0].plain_text;
    }
  }
  return page.title?.[0]?.plain_text ?? "Untitled";
}

function extractTextFromBlocks(blocks) {
  return blocks
    .map((b) => {
      const type = b.type;
      const texts = b[type]?.rich_text ?? [];
      return texts.map((t) => t.plain_text).join("");
    })
    .filter(Boolean)
    .join("\n");
}

function markdownToBlocks(text) {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => ({
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: line } }],
      },
    }));
}

function simplifyProperties(props) {
  const out = {};
  for (const [key, val] of Object.entries(props ?? {})) {
    if (val.type === "title") {
      out[key] = val.title?.[0]?.plain_text ?? "";
    } else if (val.type === "rich_text") {
      out[key] = val.rich_text?.[0]?.plain_text ?? "";
    } else if (val.type === "number") {
      out[key] = val.number;
    } else if (val.type === "select") {
      out[key] = val.select?.name ?? null;
    } else if (val.type === "date") {
      out[key] = val.date?.start ?? null;
    } else if (val.type === "checkbox") {
      out[key] = val.checkbox;
    }
  }
  return out;
}

export default brick;
