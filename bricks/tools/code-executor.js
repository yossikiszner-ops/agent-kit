/**
 * bricks/tools/code-executor.js — Sandboxed code execution via E2B
 *
 * Requires: E2B_API_KEY in .env.local
 * Free tier available → https://e2b.dev
 *
 * Runs code in a secure cloud sandbox — completely isolated from your server.
 * Supports JavaScript and Python.
 *
 * @type {import('@/core/types.js').Brick}
 */

import * as z from "zod";

const brick = {
  name: "code-executor",
  description:
    "Execute JavaScript or Python code in a secure isolated sandbox. " +
    "Use for: data analysis, computations, file processing, testing algorithms, " +
    "or any task that requires running actual code. " +
    "The sandbox has access to common libraries (numpy, pandas for Python; " +
    "lodash, axios for JavaScript). Returns stdout, stderr, and any errors.",

  requiredEnvVars: ["E2B_API_KEY"],

  parameters: z.object({
    code: z
      .string()
      .min(1)
      .max(10_000)
      .describe("The code to execute"),
    language: z
      .enum(["javascript", "python"])
      .optional()
      .default("python")
      .describe("Programming language (default: python)"),
    timeout: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .default(10)
      .describe("Execution timeout in seconds (default: 10, max: 30)"),
  }),

  execute: async ({ code, language = "python", timeout = 10 }) => {
    const apiKey = process.env.E2B_API_KEY;

    // Create a sandbox
    const createRes = await fetch("https://api.e2b.dev/sandboxes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        templateID: language === "python" ? "Python3" : "Nodejs",
        timeout,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(
        err.message ?? `E2B sandbox creation failed: HTTP ${createRes.status}`
      );
    }

    const sandbox = await createRes.json();
    const sandboxId = sandbox.sandboxID;

    try {
      // Execute the code
      const runRes = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ code }),
          signal: AbortSignal.timeout((timeout + 5) * 1000),
        }
      );

      if (!runRes.ok) {
        const err = await runRes.json().catch(() => ({}));
        throw new Error(
          err.message ?? `Code execution failed: HTTP ${runRes.status}`
        );
      }

      const result = await runRes.json();

      return {
        language,
        stdout: (result.stdout ?? "").slice(0, 5_000),
        stderr: (result.stderr ?? "").slice(0, 2_000),
        exitCode: result.exitCode ?? 0,
        error: result.error ?? null,
        executionTime: result.executionTime,
      };
    } finally {
      // Always clean up the sandbox
      await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
        method: "DELETE",
        headers: { "X-API-Key": apiKey },
      }).catch(() => {});
    }
  },

  onError: (err) =>
    `Code execution failed: ${err.message}. Check E2B_API_KEY and try simplifying the code.`,
};

export default brick;
