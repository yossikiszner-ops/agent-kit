import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const name = process.env.NEXT_PUBLIC_AGENT_NAME || "WhatsApp Gemini Agent";
  const description = process.env.NEXT_PUBLIC_AGENT_DESCRIPTION || "A Gemini-powered personal AI agent with tools and memory.";

  return NextResponse.json({
    protocolVersion: "1.0.0",
    name,
    description,
    url: `${origin}/api/a2a`,
    preferredTransport: "JSONRPC",
    additionalInterfaces: [
      { url: `${origin}/api/a2a`, transport: "JSONRPC" },
      { url: `${origin}/api/agent`, transport: "HTTP+JSON" }
    ],
    version: "1.0.0",
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [{
      id: "assistant",
      name: "Personal AI Assistant",
      description: "Answer questions, reason, research, and use the tools enabled in AgentKit.",
      tags: ["assistant", "gemini", "tools", "whatsapp"],
      examples: ["Research this topic", "Help me plan this", "Use your tools to solve this"]
    }]
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
