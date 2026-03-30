/**
 * bricks/tools/google-drive.js — Google Drive integration
 *
 * Requires: GOOGLE_ACCESS_TOKEN (from Google OAuth flow)
 * Scopes needed: https://www.googleapis.com/auth/drive.readonly
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "google-drive",
  description:
    "Search and list files in Google Drive. " +
    "Actions: search (find files by name or content), list (recent files), " +
    "get-file (read a text file's content), list-folders. " +
    "Use to find documents, spreadsheets, or presentations in the user's Drive.",

  requiredEnvVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  parameters: z.object({
    action: z
      .enum(["search", "list", "get-file", "list-folders"])
      .describe("Drive operation to perform"),
    query: z
      .string()
      .optional()
      .describe(
        "Search query. Supports Drive query syntax: " +
          "name contains 'report', mimeType='application/pdf', modifiedTime > '2026-01-01'"
      ),
    fileId: z
      .string()
      .optional()
      .describe("File ID. Used by get-file."),
    folderId: z
      .string()
      .optional()
      .describe(
        "Folder ID to list files within. Used by list and list-folders."
      ),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20),
  }),

  execute: async ({
    action,
    query,
    fileId,
    folderId,
    maxResults = 20,
  }) => {
    const token = await getAccessToken();
    const drive = (path) => driveFetch(token, path);

    switch (action) {
      case "search": {
        if (!query) {
          return { error: "Provide a query to search." };
        }
        // Escape single quotes in query
        const q = query.includes("'") ? query : `fullText contains '${query}'`;
        const params = new URLSearchParams({
          q,
          pageSize: String(maxResults),
          fields:
            "files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",
          orderBy: "modifiedTime desc",
        });
        const data = await drive(`/files?${params}`);
        return {
          count: data.files?.length ?? 0,
          files: (data.files ?? []).map(fileShape),
        };
      }

      case "list": {
        const q = folderId
          ? `'${folderId}' in parents and trashed = false`
          : "trashed = false";
        const params = new URLSearchParams({
          q,
          pageSize: String(maxResults),
          fields:
            "files(id,name,mimeType,size,modifiedTime,webViewLink)",
          orderBy: "modifiedTime desc",
        });
        const data = await drive(`/files?${params}`);
        return {
          count: data.files?.length ?? 0,
          files: (data.files ?? []).map(fileShape),
        };
      }

      case "get-file": {
        if (!fileId) {
          return { error: "Provide fileId to read a file." };
        }
        // Get file metadata first
        const meta = await drive(
          `/files/${fileId}?fields=id,name,mimeType,size`
        );

        // Only text-based mimeTypes can be read as plain text
        const textTypes = [
          "text/plain",
          "text/markdown",
          "text/csv",
          "application/json",
          "text/html",
        ];

        if (textTypes.includes(meta.mimeType)) {
          // Download raw content
          const content = await driveFetchRaw(token, `/files/${fileId}?alt=media`);
          return {
            id: meta.id,
            name: meta.name,
            mimeType: meta.mimeType,
            content: content.slice(0, 8_000),
            truncated: content.length > 8_000,
          };
        }

        // For Google Workspace files — export as plain text
        const exportTypes = {
          "application/vnd.google-apps.document": "text/plain",
          "application/vnd.google-apps.spreadsheet": "text/csv",
          "application/vnd.google-apps.presentation": "text/plain",
        };

        if (exportTypes[meta.mimeType]) {
          const content = await driveFetchRaw(
            token,
            `/files/${fileId}/export?mimeType=${encodeURIComponent(exportTypes[meta.mimeType])}`
          );
          return {
            id: meta.id,
            name: meta.name,
            mimeType: meta.mimeType,
            content: content.slice(0, 8_000),
            truncated: content.length > 8_000,
          };
        }

        return {
          id: meta.id,
          name: meta.name,
          mimeType: meta.mimeType,
          error: `Cannot read ${meta.mimeType} files as text. Use the appropriate app to open this file type.`,
        };
      }

      case "list-folders": {
        const q = folderId
          ? `mimeType = 'application/vnd.google-apps.folder' and '${folderId}' in parents`
          : "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
        const params = new URLSearchParams({
          q,
          pageSize: String(maxResults),
          fields: "files(id,name,modifiedTime,webViewLink)",
          orderBy: "name",
        });
        const data = await drive(`/files?${params}`);
        return {
          count: data.files?.length ?? 0,
          folders: (data.files ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            modifiedAt: f.modifiedTime,
            url: f.webViewLink,
          })),
        };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) =>
    `Google Drive error: ${err.message}. Ensure the Drive API is enabled and OAuth is configured.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("No Google OAuth token. Complete the OAuth flow first.");
  }
  return token;
}

async function driveFetch(token, path) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3${path}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Drive API HTTP ${res.status}`);
  }
  return res.json();
}

async function driveFetchRaw(token, path) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3${path}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!res.ok) {
    throw new Error(`Drive download failed: HTTP ${res.status}`);
  }
  return res.text();
}

function fileShape(f) {
  const sizeKb = f.size ? Math.round(f.size / 1024) : null;
  return {
    id: f.id,
    name: f.name,
    type: friendlyMimeType(f.mimeType),
    mimeType: f.mimeType,
    size: sizeKb ? `${sizeKb} KB` : null,
    modifiedAt: f.modifiedTime,
    url: f.webViewLink,
  };
}

function friendlyMimeType(mime) {
  const map = {
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/vnd.google-apps.folder": "Folder",
    "application/pdf": "PDF",
    "text/plain": "Text",
    "image/jpeg": "Image",
    "image/png": "Image",
  };
  return map[mime] ?? mime.split("/").pop();
}

export default brick;
