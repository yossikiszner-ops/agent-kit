/**
 * bricks/tools/google-calendar.js — Google Calendar integration
 *
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and a stored OAuth token.
 * Set up OAuth at https://console.cloud.google.com
 * Enable: Google Calendar API
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "google-calendar",
  description:
    "Read, create, and manage Google Calendar events. " +
    "Actions: list-events (upcoming), get-event, create-event, list-calendars. " +
    "Always check the user's calendar before scheduling to avoid conflicts.",

  requiredEnvVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],

  parameters: z.object({
    action: z
      .enum(["list-events", "get-event", "create-event", "list-calendars"])
      .describe("Calendar operation to perform"),
    calendarId: z
      .string()
      .optional()
      .default("primary")
      .describe("Calendar ID (default: 'primary' = user's main calendar)"),
    eventId: z
      .string()
      .optional()
      .describe("Event ID. Used by get-event."),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Max events to return. Used by list-events."),
    timeMin: z
      .string()
      .optional()
      .describe(
        "Start of time range (ISO 8601). Defaults to now. Used by list-events."
      ),
    timeMax: z
      .string()
      .optional()
      .describe("End of time range (ISO 8601). Used by list-events."),
    summary: z
      .string()
      .optional()
      .describe("Event title. Required for create-event."),
    description: z
      .string()
      .optional()
      .describe("Event description. Used by create-event."),
    start: z
      .string()
      .optional()
      .describe(
        "Event start datetime (ISO 8601), e.g. '2026-04-01T10:00:00+05:30'. Required for create-event."
      ),
    end: z
      .string()
      .optional()
      .describe("Event end datetime (ISO 8601). Required for create-event."),
    attendees: z
      .array(z.string().email())
      .optional()
      .describe("Email addresses to invite. Used by create-event."),
    location: z
      .string()
      .optional()
      .describe("Event location. Used by create-event."),
  }),

  execute: async ({
    action,
    calendarId = "primary",
    eventId,
    maxResults = 10,
    timeMin,
    timeMax,
    summary,
    description,
    start,
    end,
    attendees,
    location,
  }) => {
    // Get access token from stored OAuth token
    const token = await getAccessToken();

    const cal = (path, method = "GET", body) =>
      calendarFetch(token, path, method, body);

    switch (action) {
      case "list-calendars": {
        const data = await cal("/users/me/calendarList");
        return {
          calendars: (data.items ?? []).map((c) => ({
            id: c.id,
            name: c.summary,
            primary: c.primary ?? false,
            color: c.backgroundColor,
          })),
        };
      }

      case "list-events": {
        const params = new URLSearchParams({
          maxResults: String(maxResults),
          orderBy: "startTime",
          singleEvents: "true",
          timeMin: timeMin ?? new Date().toISOString(),
          ...(timeMax ? { timeMax } : {}),
        });
        const data = await cal(
          `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
        );
        return {
          count: data.items?.length ?? 0,
          events: (data.items ?? []).map(eventShape),
        };
      }

      case "get-event": {
        if (!eventId) {
          return { error: "Provide eventId." };
        }
        const data = await cal(
          `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`
        );
        return eventShape(data);
      }

      case "create-event": {
        if (!summary || !start || !end) {
          return { error: "Provide summary, start, and end to create an event." };
        }
        const eventBody = {
          summary,
          description,
          location,
          start: { dateTime: start },
          end: { dateTime: end },
          attendees: attendees?.map((email) => ({ email })),
        };
        const data = await cal(
          `/calendars/${encodeURIComponent(calendarId)}/events`,
          "POST",
          eventBody
        );
        return {
          id: data.id,
          title: data.summary,
          start: data.start?.dateTime,
          end: data.end?.dateTime,
          url: data.htmlLink,
        };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) =>
    `Google Calendar error: ${err.message}. Ensure Google Calendar API is enabled and OAuth is configured.`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken() {
  // In a real deployment, retrieve the stored OAuth refresh token
  // (e.g. from Supabase or an encrypted env var) and exchange it.
  // For now, we read from env as a starting point.
  const token = process.env.GOOGLE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "No Google OAuth token found. Complete the OAuth flow at /api/auth/google to generate one."
    );
  }
  return token;
}

async function calendarFetch(token, path, method = "GET", body) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3${path}`,
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
      err.error?.message ?? `Google Calendar API HTTP ${res.status}`
    );
  }
  return res.json();
}

function eventShape(e) {
  return {
    id: e.id,
    title: e.summary ?? "(No title)",
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location ?? null,
    description: (e.description ?? "").slice(0, 500),
    attendees: (e.attendees ?? []).map((a) => a.email),
    url: e.htmlLink,
    status: e.status,
  };
}

export default brick;
