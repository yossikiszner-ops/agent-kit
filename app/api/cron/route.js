/**
 * app/api/cron/route.js — Vercel cron job handler
 *
 * Vercel calls GET /api/cron on the schedule defined in vercel.json.
 * This route finds all enabled workflows with a cron trigger and runs them.
 *
 * Security: Vercel adds the CRON_SECRET header on Pro plans.
 * On free plans, protect with a secret in the query string instead.
 */

import { NextResponse } from "next/server";
import agentConfig from "@/agent.config.js";
import { runWorkflow, loadWorkflow } from "@/core/workflow-runner.js";

export async function GET(request) {
  // Optional: verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabledWorkflows = agentConfig.workflows ?? [];
  if (!enabledWorkflows.length) {
    return NextResponse.json({
      message: "No workflows enabled",
      ran: [],
    });
  }

  // Find workflows with cron triggers
  const cronWorkflows = [];
  for (const name of enabledWorkflows) {
    try {
      const def = await loadWorkflow(name);
      if (def.trigger?.type === "cron") {
        cronWorkflows.push(name);
      }
    } catch {
      // Skip workflows that fail to load
    }
  }

  if (!cronWorkflows.length) {
    return NextResponse.json({
      message: "No cron-triggered workflows found",
      ran: [],
    });
  }

  // Run all cron workflows (sequentially to avoid rate limits)
  const results = [];
  for (const name of cronWorkflows) {
    try {
      const result = await runWorkflow(name);
      results.push({
        workflow: name,
        success: result.success,
        durationMs: result.durationMs,
        error: result.error ?? null,
      });
    } catch (err) {
      results.push({ workflow: name, success: false, error: err.message });
    }
  }

  return NextResponse.json({
    ran: results,
    timestamp: new Date().toISOString(),
  });
}
