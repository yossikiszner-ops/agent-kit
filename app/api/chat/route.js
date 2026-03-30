/**
 * app/api/chat/route.js — Streaming chat endpoint
 *
 * Uses manual SSE streaming (same pattern as working projects).
 * toDataStreamResponse() is NOT used — we build the stream manually
 * so the client can parse it with a simple EventSource reader.
 *
 * POST body: { messages: UIMessage[], userId?: string }
 * Stream events:
 *   data: {"type":"text-delta","delta":"..."}
 *   data: {"type":"tool-call","toolName":"...","args":{}}
 *   data: {"type":"tool-result","toolName":"...","result":{}}
 */

import { NextResponse } from "next/server";
import * as z from "zod";
import { runAgent } from "@/core/agent.js";
import { rateLimit } from "@/lib/rate-limit.js";

const MessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.union([z.string(), z.array(z.unknown())]).optional(),
  parts: z.array(z.unknown()).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
}).passthrough();

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(200),
  userId: z.string().max(128).optional().default("anonymous"),
  sessionId: z.string().max(128).optional(),
});

export async function POST(request) {
  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const limit = rateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: limit.retryAfter },
      { status: 429 }
    );
  }

  // Parse body
  let raw;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { messages, userId, sessionId } = parsed.data;

  // Run agent — returns a streamText result object
  let result;
  try {
    result = await runAgent({ messages, userId, sessionId });
  } catch (err) {
    console.error("[/api/chat] runAgent failed:", err);
    return NextResponse.json(
      {
        error: "Agent failed to respond",
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }

  // Build a manual SSE stream from fullStream — same pattern as working projects
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(obj) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
          );
        } catch {
          // client disconnected
        }
      }

      try {
        for await (const event of result.fullStream) {
          if (event.type === "text-delta") {
            send({ type: "text-delta", delta: event.textDelta ?? event.text ?? "" });
          } else if (event.type === "tool-call") {
            send({
              type: "tool-call",
              toolName: event.toolName,
              args: event.args ?? event.input ?? {},
            });
          } else if (event.type === "tool-result") {
            send({
              type: "tool-result",
              toolName: event.toolName,
              result: event.result,
            });
          }
        }
      } catch (err) {
        console.error("[/api/chat] stream error:", err);
        send({ type: "error", message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}