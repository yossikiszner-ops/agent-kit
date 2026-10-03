import { generateText } from "ai";
import { getModel, getModelOptions } from "@/core/model.js";
import { getAITools } from "@/core/tool-runner.js";

export const runtime = "nodejs";
export const maxDuration = 60;

function getText(message) {
  return (message?.parts || []).map((p) => p?.text || "").filter(Boolean).join("\n").trim();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const method = String(body?.method || "").toLowerCase();
    if (!["message/send", "sendmessage", "message.send"].includes(method)) {
      return Response.json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32601, message: "Method not found" } });
    }
    const incoming = body?.params?.message || body?.params;
    const text = getText(incoming);
    if (!text) return Response.json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32602, message: "Text required" } });

    const [model, tools] = await Promise.all([getModel(), getAITools()]);
    const result = await generateText({
      model,
      system: "You are a capable personal AI agent connected through WhatsApp. Keep replies clear and mobile-friendly. Use available tools when useful.",
      prompt: text,
      tools: Object.keys(tools).length ? tools : undefined,
      maxSteps: 20,
      ...getModelOptions(),
    });
    const now = Date.now().toString(36);
    return Response.json({ jsonrpc: "2.0", id: body?.id ?? null, result: { kind: "message", role: "agent", messageId: `msg-${now}`, contextId: incoming?.contextId || `ctx-${now}`, parts: [{ kind: "text", text: result.text }] } });
  } catch (error) {
    console.error("[a2a]", error);
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: error?.message || "Internal error" } }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, protocol: "A2A", version: "1.0.0", discovery: "/.well-known/agent-card.json" });
}
