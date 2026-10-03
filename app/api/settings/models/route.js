import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return NextResponse.json({ error: "Gemini API key is not configured", models: [] }, { status: 500 });
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || "Gemini model discovery failed", models: [] }, { status: res.status });
    const models = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => ({ id: String(m.name || "").replace(/^models\//, ""), name: m.displayName || String(m.name || "").replace(/^models\//, "") }))
      .filter(m => m.id);
    return NextResponse.json({ models });
  } catch (error) {
    return NextResponse.json({ error: error.message, models: [] }, { status: 500 });
  }
}
