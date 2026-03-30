/**
 * bricks/tools/http-request.js — Generic REST API caller
 *
 * No API key required (keys are passed per-call in headers).
 * Enables the agent to call any external API the user specifies.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "http-request",
  description:
    "Make an HTTP request to any REST API. " +
    "Use this when you need to call a specific API endpoint that doesn't have its own brick. " +
    "Supports GET, POST, PUT, PATCH, DELETE. Returns the response body.",

  parameters: z.object({
    url: z
      .string()
      .url()
      .describe("The full API endpoint URL including https://"),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .optional()
      .default("GET")
      .describe("HTTP method (default: GET)"),
    headers: z
      .record(z.string())
      .optional()
      .describe(
        "Request headers as key-value pairs. " +
          "E.g. { 'Authorization': 'Bearer sk-...', 'Content-Type': 'application/json' }"
      ),
    body: z
      .record(z.unknown())
      .optional()
      .describe("Request body for POST/PUT/PATCH (will be JSON-encoded)"),
    params: z
      .record(z.string())
      .optional()
      .describe("URL query parameters as key-value pairs"),
  }),

  execute: async ({ url, method = "GET", headers = {}, body, params }) => {
    // Append query params
    const target = new URL(url);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        target.searchParams.set(k, v);
      }
    }

    // Block calls to localhost / private IPs (SSRF protection)
    const hostname = target.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    ) {
      return {
        error:
          "Requests to private/local addresses are not allowed for security reasons.",
      };
    }

    const fetchOptions = {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AgentKit/1.0",
        ...headers,
      },
      signal: AbortSignal.timeout(15_000),
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(target.toString(), fetchOptions);

    const contentType = res.headers.get("content-type") ?? "";
    let responseBody;
    if (contentType.includes("application/json")) {
      responseBody = await res.json();
    } else {
      const text = await res.text();
      responseBody = text.slice(0, 5_000); // cap large HTML responses
    }

    return {
      status: res.status,
      ok: res.ok,
      headers: Object.fromEntries(
        ["content-type", "x-ratelimit-remaining"].map((k) => [
          k,
          res.headers.get(k),
        ])
      ),
      body: responseBody,
    };
  },

  onError: (err) =>
    `HTTP request failed: ${err.message}. Check the URL and any required headers.`,
};

export default brick;
