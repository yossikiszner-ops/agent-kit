"use client";

import { useState } from "react";
import { ChevronDown, Wrench, CheckCircle, XCircle, Loader } from "lucide-react";
import { cn } from "@/lib/utils.js";

/**
 * Displays a tool invocation from AI SDK v6.
 * AI SDK v6 tool part shape: { type: "tool-invocation", toolInvocation: { ... } }
 * or the older { type: "tool-call", toolCallId, toolName, args, result, state }
 *
 * @param {{ tool: Object }} props
 */
export function ToolCallCard({ tool }) {
  const [expanded, setExpanded] = useState(false);

  // Normalise between v6 part shapes
  const invocation = tool.toolInvocation ?? tool;
  const name = invocation.toolName ?? invocation.name ?? "tool";
  const args = invocation.args ?? invocation.input ?? {};
  const result = invocation.result;
  const state = invocation.state ?? (result !== undefined ? "result" : "call");

  const isPending = state === "call" || state === "partial-call";
  const isError =
    state === "result" &&
    result &&
    typeof result === "object" &&
    result.error;
  const isSuccess = state === "result" && !isError;

  const StatusIcon = isPending ? Loader : isError ? XCircle : CheckCircle;
  const iconClass = isPending
    ? "animate-spin text-amber-500"
    : isError
      ? "text-destructive"
      : "text-emerald-500";

  return (
    <div className="w-full max-w-md rounded-lg border bg-[var(--tool-card)] border-[var(--tool-card-border)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench size={13} className="flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {formatName(name)}
        </span>
        <StatusIcon size={13} className={cn("flex-shrink-0", iconClass)} />
        <ChevronDown
          size={13}
          className={cn(
            "flex-shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-[var(--tool-card-border)] px-3 py-2 space-y-2">
          {/* Input args */}
          {args && Object.keys(args).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Input</p>
              <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-xs font-mono text-foreground">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {state === "result" && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {isError ? "Error" : "Result"}
              </p>
              <pre
                className={cn(
                  "overflow-x-auto rounded p-2 text-xs font-mono",
                  isError
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted/50 text-foreground"
                )}
              >
                {typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatName(name) {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
