/**
 * core/workflow-runner.js — YAML workflow interpreter
 *
 * Reads workflow definitions from /bricks/workflows/*.yaml
 * Executes steps sequentially or in parallel.
 * Supports {{steps.id.field}} and {{env.VAR}} template interpolation.
 *
 * @module core/workflow-runner
 */

import { parse as parseYaml } from "yaml";
import { readFile } from "fs/promises";
import { join } from "path";
import { loadBricks } from "@/core/tool-runner.js";

/**
 * Execute a named workflow by loading its YAML file and running its steps.
 *
 * @param {string} workflowName  — filename without .yaml
 * @param {Object} [context={}]  — initial context variables
 * @returns {Promise<WorkflowResult>}
 */
export async function runWorkflow(workflowName, context = {}) {
  const definition = await loadWorkflow(workflowName);
  return executeWorkflow(definition, context);
}

/**
 * @typedef {Object} WorkflowResult
 * @property {boolean} success
 * @property {string}  workflowName
 * @property {Object}  steps         — results keyed by step id
 * @property {string}  [error]
 * @property {number}  durationMs
 */

/**
 * Load and parse a workflow YAML file.
 *
 * @param {string} name
 * @returns {Promise<import('@/core/types.js').WorkflowDefinition>}
 */
export async function loadWorkflow(name) {
  const filePath = join(process.cwd(), "bricks", "workflows", `${name}.yaml`);
  try {
    const raw = await readFile(filePath, "utf-8");
    return parseYaml(raw);
  } catch (err) {
    throw new Error(
      `Could not load workflow "${name}": ${err.message}\n` +
        `Expected file at: bricks/workflows/${name}.yaml`
    );
  }
}

/**
 * List all available workflow names (YAML files in bricks/workflows/).
 *
 * @returns {Promise<string[]>}
 */
export async function listWorkflows() {
  const { readdir } = await import("fs/promises");
  const dir = join(process.cwd(), "bricks", "workflows");
  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith(".yaml") && !f.startsWith("_"))
      .map((f) => f.replace(".yaml", ""));
  } catch {
    return [];
  }
}

// ─── Execution engine ─────────────────────────────────────────────────────────

/**
 * @param {import('@/core/types.js').WorkflowDefinition} definition
 * @param {Object} initialContext
 * @returns {Promise<WorkflowResult>}
 */
async function executeWorkflow(definition, initialContext) {
  const startedAt = Date.now();
  const bricks = await loadBricks();

  /** @type {Record<string, any>} */
  const stepResults = {};
  const ctx = { ...initialContext, env: process.env };

  for (const step of definition.steps ?? []) {
    try {
      // Evaluate condition if present
      if (step.condition) {
        const conditionMet = evaluateCondition(step.condition, stepResults, ctx);
        if (!conditionMet) {
          stepResults[step.id] = { skipped: true, reason: "Condition not met" };
          continue;
        }
      }

      // Resolve template variables in input
      const resolvedInput = resolveTemplates(step.input ?? {}, stepResults, ctx);

      // Find the brick
      const brick = bricks.get(step.brick);
      if (!brick) {
        const errMsg = `Brick "${step.brick}" not found or not enabled in agent.config.js`;
        if (step.onError) {
          stepResults[step.id] = { error: errMsg, fallback: true };
          continue;
        }
        throw new Error(errMsg);
      }

      // Validate input
      const parsed = brick.parameters.safeParse(resolvedInput);
      if (!parsed.success) {
        throw new Error(
          `Invalid input for step "${step.id}": ${parsed.error.issues[0]?.message}`
        );
      }

      // Execute the brick
      const result = await brick.execute(parsed.data);
      stepResults[step.id] = result;
    } catch (err) {
      if (step.onError) {
        // Run the fallback step
        stepResults[step.id] = {
          error: err.message,
          fallback: await runFallbackStep(step.onError, bricks, stepResults, ctx),
        };
      } else {
        return {
          success: false,
          workflowName: definition.name,
          steps: stepResults,
          error: `Step "${step.id}" failed: ${err.message}`,
          durationMs: Date.now() - startedAt,
        };
      }
    }
  }

  return {
    success: true,
    workflowName: definition.name,
    steps: stepResults,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Recursively resolve {{steps.id.field}} and {{env.VAR}} in an object.
 *
 * @param {any} value
 * @param {Object} steps
 * @param {Object} ctx
 * @returns {any}
 */
function resolveTemplates(value, steps, ctx) {
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const parts = path.trim().split(".");
      if (parts[0] === "steps" && parts[1]) {
        let result = steps[parts[1]];
        for (const part of parts.slice(2)) {
          result = result?.[part];
        }
        return result !== undefined ? String(result) : "";
      }
      if (parts[0] === "env" && parts[1]) {
        return ctx.env?.[parts[1]] ?? "";
      }
      return "";
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplates(v, steps, ctx));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        resolveTemplates(v, steps, ctx),
      ])
    );
  }
  return value;
}

/**
 * Evaluate a condition expression safely.
 *
 * @param {string} condition — JS-like expression, e.g. "steps.search.results.length > 0"
 * @param {Object} steps
 * @param {Object} ctx
 * @returns {boolean}
 */
function evaluateCondition(condition, steps, ctx) {
  try {
    // eslint-disable-next-line no-new-func
    return Boolean(new Function("steps", "env", `return (${condition})`)(steps, ctx.env));
  } catch {
    return false;
  }
}

/**
 * @param {Object} onError
 * @param {Map} bricks
 * @param {Object} stepResults
 * @param {Object} ctx
 * @returns {Promise<any>}
 */
async function runFallbackStep(onError, bricks, stepResults, ctx) {
  const brick = bricks.get(onError.brick);
  if (!brick) {
    return { error: `Fallback brick "${onError.brick}" not found` };
  }
  const input = resolveTemplates(onError.input ?? {}, stepResults, ctx);
  try {
    return await brick.execute(input);
  } catch (err) {
    return { error: err.message };
  }
}
