"use client";

/**
 * app/error.js — Global error boundary
 *
 * Catches runtime errors in the React tree and shows a friendly recovery UI.
 * Next.js requires this to be a Client Component.
 */

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

/**
 * @param {{ error: Error & { digest?: string }, reset: () => void }} props
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log to console in development; swap for a real error reporter in production
    console.error("[AgentKit] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle size={22} className="text-destructive" />
      </div>

      <h1 className="mb-2 text-xl font-semibold text-foreground">
        Something went wrong
      </h1>

      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "An unexpected error occurred. Please try again."}
      </p>

      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
      >
        <RefreshCw size={14} />
        Try again
      </button>

      {process.env.NODE_ENV === "development" && error.stack && (
        <pre className="mt-6 max-w-xl overflow-x-auto rounded-lg bg-muted p-4 text-left text-xs text-muted-foreground">
          {error.stack}
        </pre>
      )}
    </div>
  );
}
