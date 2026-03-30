"use client";

import { useRef } from "react";
import { Send, Square, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils.js";

/**
 * @param {Object} props
 * @param {string}   props.input
 * @param {Function} props.onChange
 * @param {Function} props.onSubmit
 * @param {boolean}  props.isLoading
 * @param {Function} props.onStop
 * @param {string}   props.agentColor
 */
export function InputBar({
  input,
  onChange,
  onSubmit,
  isLoading,
  onStop,
  agentColor,
}) {
  const textareaRef = useRef(null);

  // Auto-grow the textarea up to 200px
  function handleChange(e) {
    onChange(e);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }

  // Submit on Enter, new line on Shift+Enter
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      if (input.trim()) {
        onSubmit(e);
        // Reset height
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }
    onSubmit(e);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-background px-3 py-2",
          "transition-shadow duration-150",
          "focus-within:shadow-[0_0_0_2px_var(--agent-ring)]"
        )}
        style={{ "--agent-ring": agentColor + "40" }}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          disabled={isLoading}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none",
            "disabled:opacity-50",
            "min-h-[36px] max-h-[200px] py-2 leading-5"
          )}
        />

        {/* Actions */}
        <div className="flex items-center gap-1 pb-0.5">
          {/* Stop button while loading */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Stop generating"
            >
              <Square size={15} />
            </button>
          ) : (
            /* Send button */
            <button
              type="submit"
              disabled={!canSend}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150",
                canSend
                  ? "text-white shadow-sm hover:opacity-90 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              style={canSend ? { backgroundColor: agentColor } : {}}
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to send
        {" · "}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </form>
  );
}
