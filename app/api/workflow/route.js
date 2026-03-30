/**
 * app/api/workflow/route.js — Workflow trigger endpoint
 *
 * POST /api/workflow
 * Body: { workflow: "workflow-name", context?: { ... } }
 *
 * GET /api/workflow
 * Returns: list of available workflows
 */

import { NextResponse } from "next/server";
import * as z from "zod";
import { runWorkflow, listWorkflows } from "@/core/workflow-runner.js";
import { rateLimit } from "@/lib/rate-limit.js";

const TriggerSchema = z.object({
  workflow: z.string().min(1).max(100),
  context: z.record(z.unknown()).optional().default({}),
});

export async function GET() {
  try {
    const workflows = await listWorkflows();
    return NextResponse.json({ workflows });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to list workflows" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`workflow:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: limit.retryAfter },
      { status: 429 }
    );
  }

  let raw;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TriggerSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { workflow, context } = parsed.data;

  try {
    const result = await runWorkflow(workflow, context);
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (err) {
    console.error(`[/api/workflow] ${workflow}:`, err);
    return NextResponse.json(
      {
        error: `Workflow "${workflow}" failed`,
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Internal error",
      },
      { status: 500 }
    );
  }
}
