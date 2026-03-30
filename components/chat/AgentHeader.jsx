"use client";

import { cn } from "@/lib/utils.js";
import { ThemeToggle } from "@/components/ui/ThemeToggle.jsx";

/**
 * @param {{ name: string, color: string, initials: string, isLoading: boolean }} props
 */
export function AgentHeader({ name, color, initials, isLoading }) {
  return (
    <header className="flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
      {/* Avatar */}
      <div
        className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
        {/* Online / thinking indicator */}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
            isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
          )}
        />
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Thinking…" : "Online"}
        </p>
      </div>

      {/* Theme toggle */}
      <ThemeToggle />
    </header>
  );
}
