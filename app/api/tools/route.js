/**
 * app/api/tools/route.js — List active bricks
 *
 * GET /api/tools
 * Returns the name + description of every loaded brick.
 * Used by the UI to show what capabilities are available.
 */

import { NextResponse } from "next/server";
import { getBrickList } from "@/core/tool-runner.js";

export async function GET() {
  try {
    const bricks = await getBrickList();
    return NextResponse.json({ bricks });
  } catch (err) {
    console.error("[/api/tools]", err);
    return NextResponse.json({ error: "Failed to load bricks" }, { status: 500 });
  }
}
