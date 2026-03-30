/**
 * app/api/memory/route.js — Memory management endpoint
 *
 * GET  /api/memory?userId=x&query=y  — recall memories
 * POST /api/memory                   — store a new memory
 * DELETE /api/memory?id=x            — delete a memory (future)
 */

import { NextResponse } from "next/server";
import * as z from "zod";
import { rememberFact, recallMemories } from "@/core/memory.js";
import { rateLimit } from "@/lib/rate-limit.js";
import agentConfig from "@/agent.config.js";

export async function GET(request) {
  if (!agentConfig.memory.longTerm) {
    return NextResponse.json(
      { error: "Long-term memory is disabled in agent.config.js" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "anonymous";
  const query = searchParams.get("query") ?? "";

  try {
    const memories = await recallMemories(userId, query, 10);
    return NextResponse.json({ memories });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

const StoreSchema = z.object({
  userId: z.string().default("anonymous"),
  content: z.string().min(5).max(2_000),
  category: z
    .enum(["preference", "personal", "project", "fact", "instruction", "other"])
    .default("fact"),
});

export async function POST(request) {
  if (!agentConfig.memory.longTerm) {
    return NextResponse.json(
      { error: "Long-term memory is disabled in agent.config.js" },
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`memory:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  let raw;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = StoreSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const entry = await rememberFact(
      parsed.data.userId,
      parsed.data.content,
      { category: parsed.data.category }
    );
    return NextResponse.json({ success: true, entry });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
