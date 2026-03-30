/**
 * core/agent.js — The central agent orchestrator
 *
 * @module core/agent
 */

import { streamText } from "ai";
import agentConfig from "@/agent.config.js";
import { getModel, getModelOptions } from "@/core/model.js";
import { getAITools } from "@/core/tool-runner.js";
import { buildMemoryContext } from "@/core/memory.js";
import { loadPersona } from "@/core/persona.js";

/**
 * Run the agent and return a streamText result.
 *
 * @param {Object}   options
 * @param {Object[]} options.messages
 * @param {string}   [options.userId="anonymous"]
 * @param {string}   [options.sessionId]
 */
export async function runAgent({ messages, userId = "anonymous", sessionId }) {
  const lastUserMessage = extractLastUserText(messages);

  const [systemPrompt, tools, model] = await Promise.all([
    buildSystemPrompt(userId, lastUserMessage),
    getAITools(),
    getModel(),
  ]);

  // Convert UIMessages → plain ModelMessages that streamText expects.
  // AI SDK v6 wants: [{ role: "user"|"assistant", content: string }]
  // We build this ourselves — no convertToModelMessages() needed.
  const modelMessages = toModelMessages(messages);

  const hasTools = Object.keys(tools).length > 0;

  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    tools: hasTools ? tools : undefined,
    maxSteps: 20,
    ...getModelOptions(),

    onStepFinish({ toolCalls, finishReason }) {
      if (process.env.NODE_ENV === "development" && toolCalls?.length) {
        console.warn(
          `[agent] step — ${toolCalls.length} tool call(s), reason: ${finishReason}`
        );
      }
    },

    onFinish({ usage, finishReason }) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[agent] done — ${usage?.totalTokens ?? "?"} tokens, reason: ${finishReason}`
        );
      }
    },
  });

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert any message shape to plain {role, content} objects.
 * Handles: parts[] (v6), content string (v5), content[] array (legacy).
 *
 * @param {Object[]} messages
 * @returns {{ role: string, content: string }[]}
 */
function toModelMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((m) => m?.role && m.role !== "system")
    .map((m) => {
      const role = m.role === "tool" ? "assistant" : m.role;
      const content = extractText(m);
      return { role, content };
    })
    .filter((m) => m.content.length > 0);
}

/**
 * Extract plain text string from any message shape.
 *
 * @param {Object} m
 * @returns {string}
 */
function extractText(m) {
  // v6: parts array
  if (Array.isArray(m.parts) && m.parts.length > 0) {
    return m.parts
      .filter((p) => p?.type === "text")
      .map((p) => p.text ?? "")
      .join("")
      .trim();
  }
  // v5: plain string
  if (typeof m.content === "string") return m.content.trim();
  // legacy: content array
  if (Array.isArray(m.content)) {
    return m.content
      .filter((p) => p?.type === "text")
      .map((p) => p.text ?? "")
      .join("")
      .trim();
  }
  return "";
}

/**
 * Extract text from last user message — used for memory context.
 *
 * @param {Object[]} messages
 * @returns {string}
 */
function extractLastUserText(messages) {
  if (!Array.isArray(messages)) return "";
  const userMsgs = messages.filter((m) => m?.role === "user");
  const last = userMsgs[userMsgs.length - 1];
  if (!last) return "";
  return extractText(last);
}

/**
 * Build the system prompt.
 *
 * @param {string} userId
 * @param {string} currentMessage
 * @returns {Promise<string>}
 */
async function buildSystemPrompt(userId, currentMessage) {
  const parts = [];

  if (agentConfig.systemPrompt) {
    parts.push(agentConfig.systemPrompt);
  } else {
    parts.push(await loadPersona(agentConfig.persona ?? "assistant"));
  }

  const name = process.env.NEXT_PUBLIC_AGENT_NAME ?? "Agent";
  parts.push(`Your name is ${name}.`);
  parts.push(
    `The current date and time is: ${new Date().toISOString()}. ` +
      `Use this for any time-sensitive questions.`
  );

  const needsMemory =
    currentMessage &&
    (agentConfig.memory.longTerm || agentConfig.memory.knowledgeBase);

  if (needsMemory) {
    const ctx = await buildMemoryContext(userId, currentMessage);
    if (ctx) parts.push(ctx);
  }

  return parts.join("\n\n");
}