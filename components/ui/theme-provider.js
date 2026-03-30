"use client";

/**
 * components/ui/theme-provider.js
 *
 * Thin wrapper around next-themes ThemeProvider.
 * Required as a client component because it uses browser APIs.
 */

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * @param {import('next-themes').ThemeProviderProps} props
 */
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
