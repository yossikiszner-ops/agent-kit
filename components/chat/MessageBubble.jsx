"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallCard } from "@/components/chat/ToolCallCard.jsx";
import { cn, timeAgo } from "@/lib/utils.js";

/**
 * Renders a single chat message.
 * Handles AI SDK v6 message structure: message.parts array.
 *
 * @param {Object}  props
 * @param {Object}  props.message        AI SDK UIMessage
 * @param {string}  props.agentName
 * @param {string}  props.agentColor
 * @param {string}  props.agentInitials
 * @param {boolean} props.showToolCalls
 */
export function MessageBubble({
  message,
  agentName,
  agentColor,
  agentInitials,
  showToolCalls,
}) {
  const isUser = message.role === "user";

  // AI SDK v6: message.parts contains typed content parts
  const parts = message.parts ?? [];

  // Extract text content and tool invocations from parts
  const textParts = parts.filter((p) => p.type === "text");
  const toolParts = parts.filter(
    (p) => p.type === "tool-invocation" || p.type === "tool-call"
  );

  // Fallback for simple string content (backwards compat)
  const textContent =
    textParts.length > 0
      ? textParts.map((p) => p.text).join("")
      : typeof message.content === "string"
        ? message.content
        : "";

  if (!textContent && toolParts.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-4 flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Agent avatar */}
      {!isUser && (
        <div
          className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
          style={{ backgroundColor: agentColor }}
        >
          {agentInitials}
        </div>
      )}

      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Tool call cards — shown before the final text response */}
        {showToolCalls &&
          toolParts.map((part, i) => (
            <ToolCallCard key={i} tool={part} />
          ))}

        {/* Text bubble */}
        {textContent && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "rounded-tr-sm bg-[var(--bubble-user)] text-[var(--bubble-user-fg)]"
                : "rounded-tl-sm bg-[var(--bubble-agent)] text-[var(--bubble-agent-fg)]"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{textContent}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ inline, children }) => {
                      if (inline) {
                        return (
                          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                            {children}
                          </code>
                        );
                      }
                      return (
                        <pre className="overflow-x-auto rounded-lg bg-muted p-3">
                          <code className="font-mono text-xs">{children}</code>
                        </pre>
                      );
                    },
                  }}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        {message.createdAt && (
          <span className="px-1 text-xs text-muted-foreground">
            {timeAgo(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
