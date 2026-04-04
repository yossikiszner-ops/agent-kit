/**
 * bricks/tools/date-time.js — Date, time, timezone & duration utilities
 *
 * No API key required. Uses the built-in Intl API.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "date-time",
  description:
    "Get the current date and time in any timezone, convert between timezones, " +
    "calculate durations between dates, add/subtract time from a date, " +
    "or format a date in a specific style. " +
    "Always use this tool for date/time questions — never compute dates mentally.",

  parameters: z.object({
    action: z
      .enum(["now", "convert", "diff", "add", "format"])
      .describe(
        "now=current time, convert=timezone conversion, diff=duration between two dates, " +
          "add=add/subtract time from a date, format=reformat a date string"
      ),
    timezone: z
      .string()
      .optional()
      .describe(
        "IANA timezone name, e.g. 'Asia/Kolkata', 'America/New_York', 'Europe/London'. " +
          "Used by 'now' and 'convert'."
      ),
    sourceTimezone: z
      .string()
      .optional()
      .describe(
        "Optional source timezone for 'convert' if the provided date is in a different timezone. " +
          "Example: convert 9 pm in Asia/Kolkata to America/New_York."
      ),
    date: z
      .string()
      .optional()
      .describe(
        "An ISO 8601 date string or natural language date like '2024-03-15' or 'March 15 2024'. " +
          "Used by 'convert', 'diff', 'add', and 'format'."
      ),
    date2: z
      .string()
      .optional()
      .describe("Second date for 'diff' action."),
    amount: z
      .number()
      .optional()
      .describe("Number of units to add (negative to subtract). Used by 'add'."),
    unit: z
      .enum(["minutes", "hours", "days", "weeks", "months", "years"])
      .optional()
      .describe("Time unit to add. Used by 'add'."),
    locale: z
      .string()
      .optional()
      .describe("BCP 47 locale for formatting, e.g. 'en-IN', 'en-US', 'de-DE'."),
  }),

  execute: async ({ action, timezone, sourceTimezone, date, date2, amount, unit, locale }) => {
    const tz = timezone ?? "UTC";
    const loc = locale ?? "en-US";

    switch (action) {
      case "now": {
        const now = new Date();
        return {
          utc: now.toISOString(),
          local: formatInTz(now, tz, loc),
          timezone: tz,
          unix: Math.floor(now.getTime() / 1000),
        };
      }

      case "convert": {
        if (!date) {
          return { error: "Provide 'date' to convert." };
        }
        const d = sourceTimezone ? parseDateInTimezone(date, sourceTimezone) : parseDate(date);
        return {
          original: date,
          converted: formatInTz(d, tz, loc),
          timezone: tz,
          sourceTimezone: sourceTimezone ?? "UTC",
        };
      }

      case "diff": {
        if (!date || !date2) {
          return { error: "Provide 'date' and 'date2' for diff." };
        }
        const d1 = parseDate(date);
        const d2 = parseDate(date2);
        const ms = Math.abs(d2.getTime() - d1.getTime());
        return {
          from: d1.toISOString(),
          to: d2.toISOString(),
          milliseconds: ms,
          seconds: Math.floor(ms / 1000),
          minutes: Math.floor(ms / 60_000),
          hours: Math.floor(ms / 3_600_000),
          days: Math.floor(ms / 86_400_000),
          weeks: Math.floor(ms / 604_800_000),
        };
      }

      case "add": {
        if (!date || amount == null || !unit) {
          return { error: "Provide 'date', 'amount', and 'unit' for add." };
        }
        const d = parseDate(date);
        const result = addTime(d, amount, unit);
        return {
          original: d.toISOString(),
          result: result.toISOString(),
          formatted: formatInTz(result, tz, loc),
        };
      }

      case "format": {
        if (!date) {
          return { error: "Provide 'date' to format." };
        }
        const d = parseDate(date);
        return {
          iso: d.toISOString(),
          long: d.toLocaleDateString(loc, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          short: d.toLocaleDateString(loc),
          time: d.toLocaleTimeString(loc),
          relative: relativeTime(d),
        };
      }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },

  onError: (err) => `Date/time tool failed: ${err.message}`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** @param {string} str @returns {Date} */
function parseDate(str) {
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new Error(`Cannot parse date: "${str}"`);
  }
  return d;
}

function parseDateInTimezone(str, timezone) {
  const [datePart, timePart = "00:00:00"] = str.split("T");
  if (!datePart || !timePart) {
    return parseDate(str);
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = "00"] = timePart.split(":").map(Number);
  const targetWall = { year, month, day, hour, minute, second };

  const start = Date.UTC(year, month - 1, day, hour, minute, second) - 86_400_000;
  const end = start + 172_800_000;

  let low = start;
  let high = end;
  while (low <= high) {
    const mid = Math.floor(((low + high) / 2) / 60000) * 60000;
    const wall = getWallTime(mid, timezone);
    const compare = compareWallTime(wall, targetWall);
    if (compare === 0) return new Date(mid);
    if (compare < 0) low = mid + 60000;
    else high = mid - 60000;
  }

  throw new Error(`Cannot parse date '${str}' in timezone '${timezone}'`);
}

function getWallTime(timestamp, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function compareWallTime(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  if (a.minute !== b.minute) return a.minute - b.minute;
  return a.second - b.second;
}

/** @param {Date} date @param {string} tz @param {string} loc @returns {string} */
function formatInTz(date, tz, loc) {
  try {
    return new Intl.DateTimeFormat(loc, {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "long",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * @param {Date} date
 * @param {number} amount
 * @param {string} unit
 * @returns {Date}
 */
function addTime(date, amount, unit) {
  const d = new Date(date);
  switch (unit) {
    case "minutes":
      d.setMinutes(d.getMinutes() + amount);
      break;
    case "hours":
      d.setHours(d.getHours() + amount);
      break;
    case "days":
      d.setDate(d.getDate() + amount);
      break;
    case "weeks":
      d.setDate(d.getDate() + amount * 7);
      break;
    case "months":
      d.setMonth(d.getMonth() + amount);
      break;
    case "years":
      d.setFullYear(d.getFullYear() + amount);
      break;
  }
  return d;
}

/** @param {Date} date @returns {string} */
function relativeTime(date) {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  const suffix = past ? " ago" : " from now";

  if (abs < 60_000) {
    return "just now";
  }
  if (abs < 3_600_000) {
    return `${Math.floor(abs / 60_000)} minutes${suffix}`;
  }
  if (abs < 86_400_000) {
    return `${Math.floor(abs / 3_600_000)} hours${suffix}`;
  }
  if (abs < 2_592_000_000) {
    return `${Math.floor(abs / 86_400_000)} days${suffix}`;
  }
  return `${Math.floor(abs / 2_592_000_000)} months${suffix}`;
}

export default brick;
