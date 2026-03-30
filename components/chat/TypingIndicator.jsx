"use client";

/**
 * components/chat/TypingIndicator.jsx
 * Animated "agent is thinking" indicator shown while streaming.
 */

/**
 * @param {{ agentColor: string, agentInitials: string }} props
 */
export function TypingIndicator({ agentColor, agentInitials }) {
  return (
    <div className="mb-4 flex gap-3">
      {/* Avatar */}
      <div
        className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
        style={{ backgroundColor: agentColor }}
      >
        {agentInitials}
      </div>

      {/* Animated dots */}
      <div className="flex items-center rounded-2xl rounded-tl-sm bg-[var(--bubble-agent)] px-4 py-3">
        <span className="flex gap-1" aria-label="Agent is thinking">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
              style={{
                animation: "bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </span>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
