/**
 * core/tool-runner.js — Brick discovery, validation, and execution
 *
 * Reads bricks[] from agent.config.js, imports each one,
 * validates the Brick contract, and converts to AI SDK tool definitions.
 *
 * @module core/tool-runner
 */

import { tool } from "ai";
import agentConfig from "@/agent.config.js";

/** @type {Map<string, import('@/core/types.js').Brick> | null} */
let _cache = null;

/**
 * Load and validate all enabled bricks. Cached after first call.
 *
 * @returns {Promise<Map<string, import('@/core/types.js').Brick>>}
 */
export async function loadBricks() {
  if (_cache) {
    return _cache;
  }

  _cache = new Map();

  for (const name of agentConfig.bricks ?? []) {
    try {
      const mod = await import(`@/bricks/tools/${name}.js`);
      const brick = mod.default ?? mod;

      assertValidBrick(brick, name);
      checkRequiredEnvVars(brick, name);

      _cache.set(name, brick);
    } catch (err) {
      // Log but don't crash — other bricks still work
      console.error(
        `\n⚠ AgentKit: Could not load brick "${name}":\n  ${err.message}\n`
      );
    }
  }

  return _cache;
}

/**
 * Convert loaded bricks to AI SDK tool definitions.
 * Pass the returned object directly as `tools` in streamText/generateText.
 *
 * @returns {Promise<Record<string, import('ai').Tool>>}
 */
export async function getAITools() {
  const bricks = await loadBricks();
  /** @type {Record<string, import('ai').Tool>} */
  const tools = {};

  for (const [name, brick] of bricks) {
    tools[name] = tool({
      description: brick.description,
      parameters: brick.parameters,
      execute: async (params) => {
        try {
          return await brick.execute(params);
        } catch (err) {
          const msg = brick.onError
            ? brick.onError(err)
            : `The "${name}" tool failed: ${err.message}`;
          return { error: msg };
        }
      },
    });
  }

  return tools;
}

/**
 * Returns name + description for every loaded brick (used by the UI).
 *
 * @returns {Promise<Array<{ name: string, description: string }>>}
 */
export async function getBrickList() {
  const bricks = await loadBricks();
  return Array.from(bricks.values()).map(({ name, description }) => ({
    name,
    description,
  }));
}

// ─── Private ──────────────────────────────────────────────────────────────────

/**
 * @param {any} brick
 * @param {string} name
 */
function assertValidBrick(brick, name) {
  if (!brick || typeof brick !== "object") {
    throw new Error(`Must export a plain object, got ${typeof brick}`);
  }
  if (typeof brick.name !== "string") {
    throw new Error(`Must have a string "name" property`);
  }
  if (typeof brick.description !== "string") {
    throw new Error(`Must have a string "description" property`);
  }
  if (typeof brick.parameters?.safeParse !== "function") {
    throw new Error(`Must have a Zod schema as "parameters"`);
  }
  if (typeof brick.execute !== "function") {
    throw new Error(`Must have an async "execute" function`);
  }
}

/**
 * @param {import('@/core/types.js').Brick} brick
 * @param {string} name
 */
function checkRequiredEnvVars(brick, name) {
  if (!brick.requiredEnvVars?.length) {
    return;
  }
  const missing = brick.requiredEnvVars.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing env vars for brick "${name}":\n` +
        missing.map((k) => `  ${k}`).join("\n") +
        `\n  Add them to .env.local to enable this brick.`
    );
  }
}
