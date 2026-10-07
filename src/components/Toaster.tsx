import clsx from "clsx";
import { useEffect, useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  tone: "success" | "error";
  title: string;
  detail?: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function showToast(toast: Omit<Toast, "id">) {
  toasts = [...toasts, { ...toast, id: nextId++ }].slice(-4);
  emit();
}

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 6000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  return (
    <div
      role="status"
      className={clsx(
        "pointer-events-auto w-80 rounded-lg border bg-surface-raised p-3 text-sm shadow-lg",
        toast.tone === "success" ? "border-long/50" : "border-short/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink">{toast.title}</span>
        <button
          type="button"
          aria-label="Dismiss"
          className="text-ink-faint hover:text-ink"
          onClick={() => dismiss(toast.id)}
        >
          ×
        </button>
      </div>
      {toast.detail && <p className="mt-1 break-all font-mono text-xs text-ink-muted">{toast.detail}</p>}
    </div>
  );
}

export function Toaster() {
  const items = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts
  );

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex flex-col gap-2">
      {items.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
