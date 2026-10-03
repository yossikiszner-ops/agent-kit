import { generateText } from "ai";
import { getModel, getModelOptions } from "@/core/model.js";
import { getAITools } from "@/core/tool-runner.js";
import agentConfig from "@/agent.config.js";
import { loadPersona } from "@/core/persona.js";

export const runtime = "nodejs";
export const maxDuration = 60;

function textFromBody(body) {
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.text === "string") return body.text;
  if (typeof body?.prompt === "string") return body.prompt;
  if (Array.isArray(body?.messages)) {
    const last = [...body.messages].reverse().find(m => m?.role === "user");
    if (typeof last?.content === "string") return last.content;
  }
  return "";
}

async function systemPrompt() {
  const base = agentConfig.systemPrompt || await loadPersona(agentConfig.persona ?? "assistant");
  const name = process.env.NEXT_PUBLIC_AGENT_NAME || "Agent";
  return `${base}\n\nYour name is ${name}. You are being used through an external messaging client such as WhatsApp. Keep formatting mobile-friendly. Current time: ${new Date().toISOString()}.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const text = textFromBody(body);
    if (!text) return Response.json({ error: "Missing message/text/prompt" }, { status: 400 });

    const [model, tools, system] = await Promise.all([getModel(), getAITools(), systemPrompt()]);
    const result = await generateText({
      model,
      system,
      prompt: text,
      tools: Object.keys(tools).length ? tools : undefined,
      maxSteps: 20,
      ...getModelOptions(),
    });

    return Response.json({
      text: result.text,
      message: result.text,
      model: process.env.AI_MODEL || "gemini-2.0-flash",
      agent: process.env.NEXT_PUBLIC_AGENT_NAME || "Agent"
    });
  } catch (error) {
    console.error("[external-agent]", error);
    return Response.json({ error: error?.message || "Agent request failed" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, agent: process.env.NEXT_PUBLIC_AGENT_NAME || "Agent", endpoint: "/api/agent" });
}
