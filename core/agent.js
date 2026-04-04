/**
 * core/agent.js — The central agent orchestrator
 *
 * @module core/agent
 */

import { streamText, generateText } from "ai";
import agentConfig from "@/agent.config.js";
import { getModel, getModelOptions } from "@/core/model.js";
import { getAITools } from "@/core/tool-runner.js";
import { buildMemoryContext } from "@/core/memory.js";
import { loadPersona } from "@/core/persona.js";

const LOCATION_TIMEZONE_MAP = {
  "india": "Asia/Kolkata",
  "ist": "Asia/Kolkata",
  "new york": "America/New_York",
  "nyc": "America/New_York",
  "newark": "America/New_York",
  "america/new_york": "America/New_York",
  "london": "Europe/London",
  "uk": "Europe/London",
  "england": "Europe/London",
  "tokyo": "Asia/Tokyo",
  "japan": "Asia/Tokyo",
  "sydney": "Australia/Sydney",
  "australia/sydney": "Australia/Sydney",
};

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

  console.log("[agent] Loaded tools:", Object.keys(tools));
  console.log("[agent] User message:", lastUserMessage);

  // Convert UIMessages → plain ModelMessages that streamText expects.
  // AI SDK v6 wants: [{ role: "user"|"assistant", content: string }]
  // We build this ourselves — no convertToModelMessages() needed.
  const modelMessages = toModelMessages(messages);

  // Check for forced tool usage based on keywords
  const forcedTool = detectForcedTool(lastUserMessage, tools);
  if (forcedTool) {
    console.log("[agent] Forcing tool usage:", forcedTool.name);
    return await runWithForcedTool(model, systemPrompt, modelMessages, forcedTool, lastUserMessage);
  }

  const hasTools = Object.keys(tools).length > 0;

  console.log("[agent] Has tools:", hasTools, "Tool names:", Object.keys(tools));

  console.log("[agent] Has tools:", hasTools, "Tool names:", Object.keys(tools));

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
        toolCalls.forEach(call => {
          console.log("[agent] Tool call:", call.toolName, call.args);
        });
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
 * Extract the last user message text for context.
 *
 * @param {Object[]} messages
 * @returns {string}
 */
function extractLastUserText(messages) {
  if (!Array.isArray(messages)) return "";

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === "user") {
      return extractText(msg);
    }
  }
  return "";
}

/**
 * Build system prompt with persona and context.
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

/**
 * Detect if a tool should be forced based on user message keywords.
 */
function detectForcedTool(message, tools) {
  const lowerMessage = message.toLowerCase();

  const dateConversion = parseDateTimeConversion(message);
  if (tools['date-time'] && dateConversion) {
    return {
      name: 'date-time',
      tool: tools['date-time'],
      extractExpression: () => ({
        action: 'convert',
        date: dateConversion.date,
        timezone: dateConversion.targetTimezone,
        sourceTimezone: dateConversion.sourceTimezone,
      }),
    };
  }

  const looksLikeMath = () => {
    const explicitMath = /\b(calculate|compute|math|sum|difference|product|quotient|plus|minus|times|divide|multiply|add|subtract|what is|how much|how many|what are)\b/.test(lowerMessage);
    const numericExpression = /(\d+\s*[\+\-\*\/]\s*\d+|\d+\s*%\s*of\s*\d+|\b\d+\s*(?:plus|minus|times|divided by|multiplied by)\s*\d+\b)/i.test(message);
    const wordExpression = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/.test(lowerMessage) && /\b(plus|minus|times|divided by|multiplied by)\b/.test(lowerMessage);
    return numericExpression || (explicitMath && (wordExpression || /\d/.test(lowerMessage)));
  };

  // Date/time triggers should take precedence over loose calculator keywords.
  if (tools['date-time'] && !looksLikeMath() && (
    /\b(time|date|day|month|year|today|tomorrow|yesterday|now|current|timezone|clock)\b/.test(lowerMessage) ||
    /\b(what time|what day|what date|when is)\b/.test(lowerMessage)
  )) {
    return { name: 'date-time', tool: tools['date-time'], extractExpression: () => ({ action: 'now', timezone: 'UTC' }) };
  }

  if (tools.calculator && looksLikeMath()) {
    return { name: 'calculator', tool: tools.calculator, extractExpression: () => normalizeMathExpression(message) };
  }

  return null;
}

function normalizeMathExpression(message) {
  const replacements = {
    "what is": "",
    "calculate": "",
    "compute": "",
    "please": "",
    "find": "",
    "answer": "",
    "equals": "",
    "equal to": "",
    "is equal to": "",
    "divided by": "/",
    "multiplied by": "*",
    "times": "*",
    "plus": "+",
    "minus": "-",
    "x": "*",
    "percent of": "% of",
    "percent": "%",
    "square-root": "sqrt",
    "square root": "sqrt",
    "to the power of": "**",
    "power of": "**",
    "raised to": "**",
    "to the": "**",
    "the": "",
    "a": "",
    "an": "",
  };

  const numberMap = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    twenty: "20",
    thirty: "30",
    forty: "40",
    fifty: "50",
    sixty: "60",
    seventy: "70",
    eighty: "80",
    ninety: "90",
  };

  let expression = message.toLowerCase();

  for (const [key, value] of Object.entries(replacements)) {
    expression = expression.replace(new RegExp(`\\b${key}\\b`, "gi"), value);
  }

  for (const [word, digit] of Object.entries(numberMap)) {
    expression = expression.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }

  // Handle function calls like "sqrt of 100" -> "sqrt(100)"
  expression = expression.replace(/(\bsqrt|sin|cos|tan|log|ln|exp|abs)\s+of\s+([^+\-*/()]+)/g, "$1($2)");

  // Handle "square of X" -> "X**2"
  expression = expression.replace(/\bsquare\s+of\s+([^+\-*/()]+)/g, "$1**2");

  // Handle "cube of X" -> "X**3"
  expression = expression.replace(/\bcube\s+of\s+([^+\-*/()]+)/g, "$1**3");

  // Handle "X to the power of Y" -> "X**Y"
  expression = expression.replace(/(\d+(?:\.\d+)?)\s*\*\*\s*(\d+(?:\.\d+)?)/g, "$1**$2");

  expression = expression.replace(/[^0-9+\-*/().%\s^ofsqrtcosintanlogexpabsceilfloorroundmaxminpie]/g, "");
  expression = expression.replace(/\s+/g, " ").trim();

  return { expression };
}

function parseDateTimeConversion(message) {
  const patterns = [
    /(?:if it is|when it is|it's|it is)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+in\s+([a-zA-Z ]+?)\s+what time(?: is it)?\s+in\s+([a-zA-Z ]+)/i,
    /what time(?: is it)?\s+in\s+([a-zA-Z ]+?)\s+(?:when|if)\s+(?:it is|it's)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+in\s+([a-zA-Z ]+)/i,
  ];

  let match = null;
  let patternIndex = -1;
  let sourceRaw = "";
  let targetRaw = "";
  let timePart = "";

  patterns.forEach((pattern, index) => {
    if (match) return;
    const result = message.match(pattern);
    if (!result) return;
    match = result;
    patternIndex = index;
  });

  if (!match) return null;

  if (patternIndex === 0) {
    timePart = match[1];
    sourceRaw = match[2];
    targetRaw = match[3];
  } else if (patternIndex === 1) {
    timePart = match[2];
    sourceRaw = match[3];
    targetRaw = match[1];
  } else {
    return null;
  }
  const sourceLocation = sourceRaw.trim().toLowerCase();
  const targetLocation = targetRaw.trim().toLowerCase();
  const sourceTimezone = LOCATION_TIMEZONE_MAP[sourceLocation] || LOCATION_TIMEZONE_MAP[sourceLocation.replace(/\s+/g, "/")];
  const targetTimezone = LOCATION_TIMEZONE_MAP[targetLocation] || LOCATION_TIMEZONE_MAP[targetLocation.replace(/\s+/g, "/")];
  if (!sourceTimezone || !targetTimezone) return null;

  const date = buildDateTimeForTimezone(timePart, sourceTimezone);
  if (!date) return null;

  return { date, sourceTimezone, targetTimezone };
}

function buildDateTimeForTimezone(timeString, timezone) {
  const timeMatch = timeString.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!timeMatch) return null;

  let [, hour, minute = "00", meridiem] = timeMatch;
  hour = Number(hour);
  minute = Number(minute);
  if (meridiem.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (meridiem.toLowerCase() === "am" && hour === 12) hour = 0;

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  const dateString = `${values.year}-${values.month}-${values.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  return dateString;
}

/**
 * Extract mathematical expression from message.
 */
function extractMathExpression(message) {
  // Simple extraction - look for numbers and operators
  const matches = message.match(/(\d+\s*[\+\-\*\/]\s*\d+|\d+\s*%\s*of\s*\d+|[0-9+\-*/().\s%]+=[0-9+\-*/().\s%]*)/i);
  return matches ? { expression: matches[0] } : { expression: message };
}

/**
 * Run agent with a forced tool call.
 */
async function runWithForcedTool(model, systemPrompt, modelMessages, forcedTool, userMessage) {
  // Create a streaming response that shows the tool call and result
  const result = {
    fullStream: createForcedToolStream(model, systemPrompt, modelMessages, forcedTool, userMessage)
  };
  return result;
}

/**
 * Create streaming response for forced tool usage.
 */
async function* createForcedToolStream(model, systemPrompt, modelMessages, forcedTool, userMessage) {
  try {
    console.log("[forced] Starting forced tool stream");

    const toolInput = forcedTool.extractExpression();
    console.log("[forced] Tool input:", toolInput);
    yield { type: "tool-call", toolName: forcedTool.name, args: toolInput };
    console.log("[forced] Yielded tool call");

    const toolResult = await forcedTool.tool.execute(toolInput);
    console.log("[forced] Tool result:", toolResult);
    yield { type: "tool-result", toolName: forcedTool.name, result: toolResult };
    console.log("[forced] Yielded tool result");

    const humanMessage = formatToolResult(forcedTool.name, toolResult, toolInput);
    yield { type: "text-delta", textDelta: `${humanMessage}\n\n` };
    console.log("[forced] Yielded result display");

  } catch (err) {
    console.error("[agent] Forced tool error:", err);
    yield { type: "text-delta", textDelta: "I apologize, but I encountered an error while processing your request." };
  }
}

function formatToolResult(toolName, toolResult, toolInput) {
  if (toolResult?.error) {
    return `I tried to use the ${toolName} tool, but it returned an error: ${toolResult.error}`;
  }

  if (toolName === "calculator") {
    if (toolResult?.result != null) {
      const expression = toolInput?.expression || "expression";
      return `The answer for ${expression} is ${toolResult.result}.`;
    }
    return `The calculator returned: ${toolResult?.result ?? JSON.stringify(toolResult)}`;
  }

  if (toolName === "date-time") {
    if (toolResult?.converted) {
      return `Converted time: ${toolResult.converted}`;
    }
    if (toolResult?.local && toolResult?.timezone) {
      return `Local time in ${toolResult.timezone}: ${toolResult.local}`;
    }
  }

  if (typeof toolResult === "string") {
    return toolResult;
  }

  if (toolResult && typeof toolResult === "object") {
    const entries = Object.entries(toolResult)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ");
    return `Tool result: ${entries}`;
  }

  return `Tool result: ${String(toolResult)}`;
}
