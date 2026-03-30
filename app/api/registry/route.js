/**
 * app/api/registry/route.js — Agent registry
 *
 * POST /api/registry — submit this agent to agents.smartly.ventures
 * GET  /api/registry — check if this agent is registered
 *
 * Only runs if REGISTRY_ENABLED=true in .env.local
 */

import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.js";
import { agentIdentity } from "@/lib/env.js";

const REGISTRY_URL = "https://agents.smartly.ventures/api/register";

export async function GET() {
  if (!serverEnv.REGISTRY_ENABLED) {
    return NextResponse.json({
      registered: false,
      message: "Registry is disabled. Set REGISTRY_ENABLED=true in .env.local to opt in.",
    });
  }

  return NextResponse.json({
    registered: true,
    agentName: agentIdentity.name,
    registryUrl: REGISTRY_URL,
  });
}

export async function POST(request) {
  if (!serverEnv.REGISTRY_ENABLED) {
    return NextResponse.json(
      { error: "Registry is disabled. Set REGISTRY_ENABLED=true to enable." },
      { status: 403 }
    );
  }

  const appUrl = agentIdentity.appUrl;
  if (!appUrl || appUrl === "http://localhost:3000") {
    return NextResponse.json(
      {
        error:
          "Set NEXT_PUBLIC_APP_URL to your deployed URL before registering. " +
          "You can't register a localhost agent.",
      },
      { status: 400 }
    );
  }

  try {
    const payload = {
      name: agentIdentity.name,
      description: agentIdentity.description,
      url: appUrl,
      color: agentIdentity.color,
    };

    const res = await fetch(REGISTRY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message ?? `Registry returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      message: `Agent "${agentIdentity.name}" registered successfully.`,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach registry: ${err.message}` },
      { status: 502 }
    );
  }
}
