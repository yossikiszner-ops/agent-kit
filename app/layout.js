/**
 * app/layout.js — Root layout
 *
 * Sets up fonts, metadata, theme, and the Toaster notification system.
 * Wraps all pages.
 */

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ui/theme-provider.js";
import { agentIdentity } from "@/lib/env.js";
import "@/app/globals.css";

export const metadata = {
  title: agentIdentity.name,
  description: agentIdentity.description,
  metadataBase: new URL(agentIdentity.appUrl),
  openGraph: {
    title: agentIdentity.name,
    description: agentIdentity.description,
    type: "website",
  },
};

/**
 * @param {{ children: React.ReactNode }} props
 */
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <link
          rel="icon"
          href={`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${encodeURIComponent(agentIdentity.color)}"/><text x="16" y="22" text-anchor="middle" font-size="14" font-family="system-ui" font-weight="600" fill="white">${agentIdentity.initials}</text></svg>`}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme={agentIdentity.theme}
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
