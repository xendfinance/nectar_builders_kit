import clsx from "clsx";
import type { ReactNode } from "react";

import type { EndpointId, UiSource } from "@/api/catalog";

import { ApiBadge } from "./ApiBadge";

interface CardProps {
  title?: ReactNode;
  /** Endpoints that feed this card, shown as clickable badges under the title. */
  endpoints?: EndpointId[];
  source?: UiSource;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Card({ title, endpoints, source, actions, className, bodyClassName, children }: CardProps) {
  const hasHeader = title !== undefined || actions !== undefined || endpoints !== undefined;

  return (
    <section className={clsx("flex min-w-0 flex-col rounded-lg border border-surface-line bg-surface-card", className)}>
      {hasHeader && (
        <header className="flex flex-col gap-2 border-b border-surface-line px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {title !== undefined && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {actions}
          </div>
          {endpoints !== undefined && <ApiBadge endpoints={endpoints} source={source} />}
        </header>
      )}
      <div className={clsx("min-h-0 flex-1", bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}
