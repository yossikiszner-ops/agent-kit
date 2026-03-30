/**
 * core/types.js — Shared JSDoc type definitions
 *
 * Import these with: /** @type {import('@/core/types.js').TypeName} *\/
 * No compile step needed — pure documentation used by VS Code for autocomplete.
 *
 * @module core/types
 */

// ─── Brick ────────────────────────────────────────────────────────────────────
/**
 * The contract every brick must satisfy.
 * Create a file in /bricks/tools/<name>.js exporting this shape.
 *
 * @typedef {Object} Brick
 * @property {string}   name             Unique snake_case id. Matches the name in bricks[] config.
 * @property {string}   description      What the tool does — shown to the AI model, be specific.
 * @property {import('zod').ZodSchema} parameters  Zod schema validating the tool's input.
 * @property {string[]} [requiredEnvVars] Env var names needed. Checked at startup with a clear error.
 * @property {(params: any) => Promise<any>} execute  The tool logic. Must return JSON-serialisable data.
 * @property {(error: Error) => string} [onError]     Friendly error string returned to the AI on failure.
 */

// ─── Workflow ─────────────────────────────────────────────────────────────────
/**
 * @typedef {"sequential" | "parallel"} StepMode
 *
 * @typedef {Object} WorkflowStep
 * @property {string}      id         Unique step id within the workflow.
 * @property {string}      brick      Name of the brick to call.
 * @property {Object}      input      Input params. Reference prior steps with {{steps.id.field}}.
 * @property {StepMode}    [mode]     "sequential" (default) or "parallel".
 * @property {string}      [condition] JS expression — step runs only if truthy.
 * @property {Object}      [onError]  Fallback step definition if this step fails.
 *
 * @typedef {Object} WorkflowTrigger
 * @property {"manual"|"cron"|"webhook"} type
 * @property {string} [schedule]   Cron expression (cron triggers only).
 * @property {string} [path]       Webhook path (webhook triggers only).
 *
 * @typedef {Object} WorkflowDefinition
 * @property {string}             name
 * @property {string}             description
 * @property {WorkflowTrigger}    trigger
 * @property {WorkflowStep[]}     steps
 */

// ─── Memory ───────────────────────────────────────────────────────────────────
/**
 * @typedef {"short_term" | "long_term" | "knowledge_base"} MemoryTier
 *
 * @typedef {Object} MemoryEntry
 * @property {string}      id
 * @property {string}      content
 * @property {MemoryTier}  tier
 * @property {Object}      [metadata]
 * @property {number}      [score]     Similarity score 0–1, present on recall results.
 * @property {Date}        createdAt
 */

// ─── Chat ─────────────────────────────────────────────────────────────────────
/**
 * @typedef {"user"|"assistant"|"system"|"tool"} MessageRole
 *
 * @typedef {Object} ToolCall
 * @property {string} id
 * @property {string} name
 * @property {Object} input
 * @property {any}    [result]
 * @property {"pending"|"success"|"error"} status
 *
 * @typedef {Object} ChatMessage
 * @property {string}      id
 * @property {MessageRole} role
 * @property {string|Object[]} content
 * @property {Date}        createdAt
 * @property {ToolCall[]}  [toolCalls]
 */

// ─── Config ───────────────────────────────────────────────────────────────────
/**
 * @typedef {Object} ModelConfig
 * @property {"gemini"|"openai"|"anthropic"|"groq"} provider
 * @property {string} model
 * @property {number} temperature
 * @property {number} maxTokens
 *
 * @typedef {Object} MemoryConfig
 * @property {boolean} shortTerm
 * @property {boolean} longTerm
 * @property {boolean} knowledgeBase
 *
 * @typedef {Object} UIConfig
 * @property {"light"|"dark"|"system"} theme
 * @property {boolean}  showToolCalls
 * @property {boolean}  showThinking
 * @property {boolean}  branding
 * @property {string[]} [suggestedPrompts]
 *
 * @typedef {Object} AgentKitConfig
 * @property {ModelConfig}  model
 * @property {MemoryConfig} memory
 * @property {string[]}     bricks
 * @property {string[]}     workflows
 * @property {UIConfig}     ui
 * @property {string|null}  [systemPrompt]
 * @property {string}       [persona]
 */

export {};
