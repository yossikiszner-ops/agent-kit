"use client";

/**
 * components/ui/ThemeToggle.jsx — Light / dark mode toggle
 *
 * Usage: <ThemeToggle />
 */

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme.js";
import { cn } from "@/lib/utils.js";

/**
 * @param {{ className?: string }} props
 */
export function ThemeToggle({ className }) {
  const { toggleTheme, isDark, mounted } = useTheme();

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div
        className={cn(
          "h-8 w-8 rounded-lg bg-muted animate-pulse",
          className
        )}
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        "transition-colors duration-150",
        className
      )}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
