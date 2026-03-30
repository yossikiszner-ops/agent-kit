"use client";

/**
 * hooks/useTheme.js — Theme toggle utilities
 *
 * Thin wrapper around next-themes for convenient use in components.
 *
 * Usage:
 *   import { useTheme } from "@/hooks/useTheme.js";
 *   const { theme, toggleTheme, setTheme } = useTheme();
 */

import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * @returns {{
 *   theme: string,
 *   resolvedTheme: string,
 *   setTheme: (theme: string) => void,
 *   toggleTheme: () => void,
 *   isDark: boolean,
 *   isLight: boolean,
 *   mounted: boolean,
 * }}
 */
export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only read theme after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return {
    theme: mounted ? theme : "system",
    resolvedTheme: mounted ? resolvedTheme : "light",
    setTheme,
    toggleTheme,
    isDark: mounted && resolvedTheme === "dark",
    isLight: mounted && resolvedTheme === "light",
    mounted,
  };
}
