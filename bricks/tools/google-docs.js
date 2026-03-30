/**
 * bricks/tools/google-docs.js — Google Docs integration
 *
 * Requires: GOOGLE_ACCESS_TOKEN (from Google OAuth flow)
 * Scopes needed: https://www.googleapis.com/auth/documents
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "google-docs",
  description:
    "Read and write Google Docs documents. " +
    "Actions: read (get document content), create (make a new document), " +
    "append (add text to end of document), replace (find and replace text).",

  requiredEnvVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  parameters: z.object({
    action: z
      .enum(["read", "create", "append", "replace"])
      .describe(
        "read=get content, create=new document, " +
          "append=add text to end, replace=find and replace text"
      ),
    documentId: z
      .string()
      .optional()
      .describe(
        "Google Doc ID from URL: https://docs.google.com/document/d/{ID}/edit"
      ),
    title: z
      .string()
      .optional()
      .describe("Document title for create action"),
    content: z
      .string()
      .optional()
      .describe("Text content to append or use as body when creating"),
    findText: z
      .string()
      .optional()
      .describe("Text to find for replace action"),
    replaceText: z
      .string()
      .optional()
      .describe("Replacement text for replace action"),
  }),

  execute: async ({
    action,
    documentId,
    title,
    content,
    findText,
    replaceText,
  }) => {
    const token = await getAccessToken();
    const docs = (path, method = "GET", body) =>
      docsFetch(token, path, method, body);

    switch (action) {
      case "read": {
        if (!documentId) {
          return { error: "Provide documentId to read." };
        }
        const doc = await docs(`/documents/${documentId}`);
        const text = extractDocText(doc);
        return {
          id: doc.documentId,
          title: doc.title,
          content: text.slice(0, 10_000),
          truncated: text.length > 10_000,
          revisionId: doc.revisionId,
        };
      }

      case "create": {
        if (!title) {
          return { error: "Provide a title for the new document." };
        }
        // Create the document
        const doc = await docs("/documents", "POST", { title });

        // If content was provided, insert it
        if (content) {
          await docs(`/documents/${doc.documentId}:batchUpdate`, "POST", {
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: content,
                },
              },
            ],
          });
        }

        return {
          id: doc.documentId,
          title: doc.title,
          url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        };
      }

      case "append": {
        if (!documentId || !content) {
          return { error: "Provide documentId and content to append." };
        }
        // Get current document length
        const doc = await docs(`/documents/${documentId}`);
        const endIndex = getDocEndIndex(doc);

        await docs(`/documents/${documentId}:batchUpdate`, "POST", {
          requests: [
            {
              insertText: {
                location: { index: endIndex - 1 },
                text: "\n" + content,
              },
            },
          ],
        });

        return {
          success: true,
          documentId,
          appended: content.length,
          url: `https://docs.google.com/document/d/${documentId}/edit`,
        };
      }

      case "replace": {
        if (!documentId || !findText || replaceText === undefined) {
          return {
            error: "Provide documentId, findText, and replaceText.",
          };
        }
        await docs(`/documents/${documentId}:batchUpdate`, "POST", {
          requests: [
            {
              replaceAllText: {
                containsText: { text: findText, matchCase: true },
                replaceText,
              },
            },
          ],
        });
        return { success: true, documentId, replaced: findText };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) =>
    `Google Docs error: ${err.message}. Ensure the Google Docs API is enabled and OAuth is configured.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("No Google OAuth token. Complete the OAuth flow first.");
  }
  return token;
}

async function docsFetch(token, path, method = "GET", body) {
  const res = await fetch(
    `https://docs.googleapis.com/v1${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Docs API HTTP ${res.status}`);
  }
  return res.json();
}

function extractDocText(doc) {
  const parts = [];
  for (const el of doc.body?.content ?? []) {
    if (el.paragraph) {
      const text = (el.paragraph.elements ?? [])
        .map((e) => e.textRun?.content ?? "")
        .join("");
      parts.push(text);
    }
  }
  return parts.join("");
}

function getDocEndIndex(doc) {
  const content = doc.body?.content ?? [];
  if (!content.length) {
    return 1;
  }
  return content[content.length - 1].endIndex ?? 1;
}

export default brick;
