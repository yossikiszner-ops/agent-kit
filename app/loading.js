/**
 * app/loading.js — Loading skeleton
 *
 * Shown by Next.js while the page is loading / hydrating.
 * Matches the chat UI layout to prevent layout shift.
 */

export default function Loading() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Body skeleton — mimics a welcome state */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-4 flex gap-2">
          {[120, 96, 140].map((w) => (
            <div
              key={w}
              className="h-8 animate-pulse rounded-full bg-muted"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      {/* Input skeleton */}
      <div className="border-t px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
