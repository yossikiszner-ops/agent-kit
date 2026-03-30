/**
 * bricks/tools/google-sheets.js — Google Sheets integration
 *
 * Requires: GOOGLE_ACCESS_TOKEN (from Google OAuth flow)
 * Scopes needed: https://www.googleapis.com/auth/spreadsheets
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "google-sheets",
  description:
    "Read data from and write data to Google Sheets spreadsheets. " +
    "Actions: read-range (get cell values), write-range (set cell values), " +
    "append-rows (add rows at the end), get-sheets (list sheet tabs), clear-range. " +
    "Use A1 notation for ranges, e.g. 'Sheet1!A1:D10'.",

  requiredEnvVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  parameters: z.object({
    action: z
      .enum([
        "read-range",
        "write-range",
        "append-rows",
        "get-sheets",
        "clear-range",
      ])
      .describe("Sheets operation to perform"),
    spreadsheetId: z
      .string()
      .describe(
        "The spreadsheet ID from the URL: https://docs.google.com/spreadsheets/d/{ID}/edit"
      ),
    range: z
      .string()
      .optional()
      .describe(
        "Cell range in A1 notation, e.g. 'Sheet1!A1:D10' or just 'A1:D10' for the first sheet."
      ),
    values: z
      .array(z.array(z.unknown()))
      .optional()
      .describe(
        "2D array of values to write. Each inner array is a row. " +
          "E.g. [['Name', 'Score'], ['Alice', 95], ['Bob', 87]]"
      ),
    valueInputOption: z
      .enum(["RAW", "USER_ENTERED"])
      .optional()
      .default("USER_ENTERED")
      .describe(
        "RAW = values stored as-is. USER_ENTERED = interpreted like typing into Sheets (parses dates, formulas, etc.)"
      ),
  }),

  execute: async ({
    action,
    spreadsheetId,
    range,
    values,
    valueInputOption = "USER_ENTERED",
  }) => {
    const token = await getAccessToken();
    const sheets = (path, method = "GET", body) =>
      sheetsFetch(token, path, method, body);

    const sid = encodeURIComponent(spreadsheetId);

    switch (action) {
      case "get-sheets": {
        const data = await sheets(`/spreadsheets/${sid}?fields=sheets.properties`);
        return {
          sheets: (data.sheets ?? []).map((s) => ({
            id: s.properties.sheetId,
            title: s.properties.title,
            index: s.properties.index,
            rows: s.properties.gridProperties?.rowCount,
            cols: s.properties.gridProperties?.columnCount,
          })),
        };
      }

      case "read-range": {
        if (!range) {
          return { error: "Provide a range, e.g. 'Sheet1!A1:D20'" };
        }
        const data = await sheets(
          `/spreadsheets/${sid}/values/${encodeURIComponent(range)}`
        );
        const rows = data.values ?? [];
        return {
          range: data.range,
          rowCount: rows.length,
          columnCount: rows[0]?.length ?? 0,
          values: rows,
        };
      }

      case "write-range": {
        if (!range || !values) {
          return { error: "Provide range and values to write." };
        }
        const data = await sheets(
          `/spreadsheets/${sid}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`,
          "PUT",
          { range, majorDimension: "ROWS", values }
        );
        return {
          updatedRange: data.updatedRange,
          updatedRows: data.updatedRows,
          updatedColumns: data.updatedColumns,
          updatedCells: data.updatedCells,
        };
      }

      case "append-rows": {
        if (!range || !values) {
          return { error: "Provide range (for context) and values to append." };
        }
        const data = await sheets(
          `/spreadsheets/${sid}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`,
          "POST",
          { majorDimension: "ROWS", values }
        );
        return {
          updatedRange: data.updates?.updatedRange,
          appendedRows: values.length,
        };
      }

      case "clear-range": {
        if (!range) {
          return { error: "Provide a range to clear." };
        }
        await sheets(
          `/spreadsheets/${sid}/values/${encodeURIComponent(range)}:clear`,
          "POST",
          {}
        );
        return { success: true, clearedRange: range };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) =>
    `Google Sheets error: ${err.message}. Check the spreadsheet ID and that it's shared with your Google account.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "No Google OAuth token found. Complete the Google OAuth flow to enable Sheets access."
    );
  }
  return token;
}

async function sheetsFetch(token, path, method = "GET", body) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4${path}`,
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
    throw new Error(
      err.error?.message ?? `Sheets API HTTP ${res.status}`
    );
  }
  return res.json();
}

export default brick;
