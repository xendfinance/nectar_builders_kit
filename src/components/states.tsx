import clsx from "clsx";
import type { ReactNode } from "react";

import { getErrorMessage, isApiError } from "@/api/errors";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-label="Loading"
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-faint border-t-primary",
        className
      )}
    />
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
      <Spinner />
      {label}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-sm text-ink-faint">{children}</div>;
}

/** Shows the API error code next to the message, because builders need the code to handle it. */
export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-short/40 bg-short/10 p-3 text-sm">
      {isApiError(error) && (
        <span className="font-mono text-xs text-short">
          {error.status > 0 ? `HTTP ${error.status} · ` : ""}
          {error.code}
        </span>
      )}
      <span className="text-ink">{getErrorMessage(error)}</span>
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-md border p-3 text-sm",
        tone === "warn" ? "border-warn/40 bg-warn/10 text-ink" : "border-info/40 bg-info/10 text-ink"
      )}
    >
      {children}
    </div>
  );
}
