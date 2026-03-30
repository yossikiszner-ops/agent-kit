"use client";

/**
 * components/chat/SuggestedPrompts.jsx
 * Quick-start prompt chips shown when the chat is empty.
 */

/**
 * @param {Object} props
 * @param {string[]} props.prompts
 * @param {(prompt: string) => void} props.onSelect
 * @param {string} props.color
 */
export function SuggestedPrompts({ prompts, onSelect, color }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          className="rounded-full border bg-background px-4 py-2 text-sm text-foreground shadow-sm transition-all hover:shadow-md hover:scale-105 active:scale-95"
          style={{
            "--prompt-color": color,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = color;
            e.currentTarget.style.color = color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.color = "";
          }}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
