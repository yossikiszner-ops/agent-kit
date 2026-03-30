"use client";

/**
 * components/chat/ChatWindow.jsx
 *
 * Manual SSE stream consumer — matches the working project pattern exactly.
 * Does NOT use useChat() — parses the SSE events from /api/chat directly.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble.jsx";
import { InputBar } from "@/components/chat/InputBar.jsx";
import { TypingIndicator } from "@/components/chat/TypingIndicator.jsx";
import { SuggestedPrompts } from "@/components/chat/SuggestedPrompts.jsx";
import { AgentHeader } from "@/components/chat/AgentHeader.jsx";

export function ChatWindow({
  agentName,
  agentColor,
  agentInitials,
  welcomeMessage,
  suggestedPrompts,
  showToolCalls,
  showBranding,
  userId = "anonymous",
}) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isLoading) return;
    setError(null);

    // Add user message immediately
    const userId_ = "u-" + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: userId_,
        role: "user",
        content: text,
        parts: [{ type: "text", text }],
      },
    ]);
    setIsLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Build messages array for the API
      const apiMessages = [
        ...messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content ?? "",
          parts: m.parts ?? [{ type: "text", text: m.content ?? "" }],
        })),
        {
          id: userId_,
          role: "user",
          content: text,
          parts: [{ type: "text", text }],
        },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, userId }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
      }

      // Add empty assistant message that we'll stream into
      const aid = "a-" + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: aid,
          role: "assistant",
          content: "",
          parts: [{ type: "text", text: "" }],
        },
      ]);

      // Read the SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let toolParts = [];
      let buf = "";

      function updateAssistantMsg(text, tools) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aid) return m;
            const parts = [
              { type: "text", text },
              ...tools,
            ];
            return { ...m, content: text, parts };
          })
        );
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const obj = JSON.parse(line.slice(6));

            if (obj.type === "text-delta" && obj.delta) {
              acc += obj.delta;
              updateAssistantMsg(acc, toolParts);
            } else if (obj.type === "tool-call") {
              toolParts = [
                ...toolParts,
                {
                  type: "tool-invocation",
                  state: "call",
                  toolName: obj.toolName,
                  args: obj.args ?? {},
                  toolInvocation: {
                    toolName: obj.toolName,
                    args: obj.args ?? {},
                    state: "call",
                  },
                },
              ];
              updateAssistantMsg(acc, toolParts);
            } else if (obj.type === "tool-result") {
              toolParts = toolParts.map((p) => {
                if (
                  p.type === "tool-invocation" &&
                  p.toolName === obj.toolName &&
                  p.state === "call"
                ) {
                  return {
                    ...p,
                    state: "result",
                    toolInvocation: {
                      ...p.toolInvocation,
                      state: "result",
                      result: obj.result,
                    },
                  };
                }
                return p;
              });
              updateAssistantMsg(acc, toolParts);
            } else if (obj.type === "error") {
              setError(obj.message ?? "Stream error");
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("[chat]", err);
        setError(err.message ?? "Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, userId]);

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault();
      const text = inputValue.trim();
      if (!text) return;
      setInputValue("");
      sendMessage(text);
    },
    [inputValue, sendMessage]
  );

  const handleSuggestedPrompt = useCallback((prompt) => {
    setInputValue(prompt);
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      <AgentHeader
        name={agentName}
        color={agentColor}
        initials={agentInitials}
        isLoading={isLoading}
      />

      <div className="chat-scroll flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">

          {isEmpty && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-semibold text-white shadow-sm"
                style={{ backgroundColor: agentColor }}
              >
                {agentInitials}
              </div>
              <h1 className="mb-2 text-2xl font-semibold text-foreground">
                {agentName}
              </h1>
              <p className="mb-8 max-w-md text-muted-foreground">
                {welcomeMessage}
              </p>
              {suggestedPrompts?.length > 0 && (
                <SuggestedPrompts
                  prompts={suggestedPrompts}
                  onSelect={handleSuggestedPrompt}
                  color={agentColor}
                />
              )}
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              agentName={agentName}
              agentColor={agentColor}
              agentInitials={agentInitials}
              showToolCalls={showToolCalls}
            />
          ))}

          {isLoading && messages.at(-1)?.role === "user" && (
            <TypingIndicator agentColor={agentColor} agentInitials={agentInitials} />
          )}

          {error && (
            <div className="my-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <InputBar
            input={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onStop={stop}
            agentColor={agentColor}
          />
          {showBranding && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Built with{" "}
              <a
                href="https://github.com/smartly-ventures/agentkit"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                AgentKit
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}