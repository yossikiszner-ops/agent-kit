/**
 * app/not-found.js — 404 page
 */

import Link from "next/link";
import { agentIdentity } from "@/lib/env.js";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      {/* Agent avatar */}
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-semibold text-white"
        style={{ backgroundColor: agentIdentity.color }}
      >
        {agentIdentity.initials}
      </div>

      <h1 className="mb-2 text-5xl font-semibold text-foreground">404</h1>

      <p className="mb-1 text-lg font-medium text-foreground">
        Page not found
      </p>

      <p className="mb-6 text-sm text-muted-foreground">
        This page doesn&apos;t exist. Head back to chat with {agentIdentity.name}.
      </p>

      <Link
        href="/"
        className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
        style={{ backgroundColor: agentIdentity.color }}
      >
        Back to {agentIdentity.name}
      </Link>
    </div>
  );
}
