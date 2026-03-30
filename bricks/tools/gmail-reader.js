/**
 * bricks/tools/gmail-reader.js — Read and search Gmail
 *
 * Requires: GOOGLE_ACCESS_TOKEN (from Google OAuth flow)
 * Scopes needed: https://www.googleapis.com/auth/gmail.readonly
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "gmail-reader",
  description:
    "Search, list, and read Gmail messages. " +
    "Actions: search (find emails by query), list (recent inbox), read (get email content), " +
    "get-labels (list all labels/folders). " +
    "Use Gmail search syntax: from:, to:, subject:, is:unread, after:, before:, has:attachment.",

  requiredEnvVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  parameters: z.object({
    action: z
      .enum(["search", "list", "read", "get-labels"])
      .describe("Gmail operation"),
    query: z
      .string()
      .optional()
      .describe(
        "Gmail search query. E.g. 'is:unread from:boss@company.com', 'subject:invoice after:2026/01/01'"
      ),
    messageId: z
      .string()
      .optional()
      .describe("Gmail message ID. Used by 'read'."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10),
  }),

  execute: async ({ action, query, messageId, maxResults = 10 }) => {
    const token = await getAccessToken();
    const gmail = (path) => gmailFetch(token, path);

    switch (action) {
      case "get-labels": {
        const data = await gmail("/users/me/labels");
        return {
          labels: (data.labels ?? []).map((l) => ({
            id: l.id,
            name: l.name,
            type: l.type,
          })),
        };
      }

      case "list":
      case "search": {
        const q = action === "list" ? "in:inbox" : (query ?? "in:inbox");
        const data = await gmail(
          `/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`
        );

        if (!data.messages?.length) {
          return { count: 0, messages: [], query: q };
        }

        // Fetch message summaries in parallel (batched to 5)
        const ids = (data.messages ?? []).map((m) => m.id);
        const summaries = await batchFetch(
          ids,
          (id) => gmail(`/users/me/messages/${id}?format=metadata&metadataHeaders=From,To,Subject,Date`),
          5
        );

        return {
          count: summaries.length,
          estimatedTotal: data.resultSizeEstimate,
          query: q,
          messages: summaries.map(messageShape),
        };
      }

      case "read": {
        if (!messageId) {
          return { error: "Provide messageId to read an email." };
        }
        const data = await gmail(`/users/me/messages/${messageId}?format=full`);
        return readMessageShape(data);
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) =>
    `Gmail error: ${err.message}. Ensure the Gmail API is enabled and OAuth is set up.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "No Google OAuth token found. Complete the Google OAuth flow to enable Gmail access."
    );
  }
  return token;
}

async function gmailFetch(token, path) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Gmail API HTTP ${res.status}`);
  }
  return res.json();
}

/** Run fn on batches of size n, collecting results */
async function batchFetch(ids, fn, batchSize) {
  const results = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const r of settled) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      }
    }
  }
  return results;
}

function getHeader(headers, name) {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function messageShape(msg) {
  const headers = msg.payload?.headers ?? [];
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    snippet: msg.snippet ?? "",
    labels: msg.labelIds ?? [],
    unread: (msg.labelIds ?? []).includes("UNREAD"),
  };
}

function readMessageShape(msg) {
  const headers = msg.payload?.headers ?? [];
  const body = extractBody(msg.payload);
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    labels: msg.labelIds ?? [],
    unread: (msg.labelIds ?? []).includes("UNREAD"),
    body: body.slice(0, 5_000),
    hasAttachments: (msg.payload?.parts ?? []).some(
      (p) => p.filename && p.filename.length > 0
    ),
  };
}

function extractBody(payload) {
  if (!payload) {
    return "";
  }
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
  }
  // Fallback: try HTML and strip tags
  for (const part of payload.parts ?? []) {
    if (part.mimeType === "text/html" && part.body?.data) {
      return Buffer.from(part.body.data, "base64")
        .toString("utf-8")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return "";
}

export default brick;
