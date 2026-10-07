import clsx from "clsx";

import { ENDPOINTS } from "@/api/catalog";
import type { EndpointId, UiSource } from "@/api/catalog";
import { inspector, selectLatestCall, useInspector } from "@/inspector/store";

import { MethodTag } from "./MethodTag";

/**
 * Shows which endpoint feeds a panel and how its latest call went. Clicking opens the API Inspector filtered to it.
 */
function ApiBadgeItem({ endpointId, source }: { endpointId: EndpointId; source?: UiSource }) {
  const endpoint = ENDPOINTS[endpointId];
  const latest = useInspector(selectLatestCall(endpointId, source));

  return (
    <button
      type="button"
      onClick={() => inspector.open({ endpointFilter: endpointId, selectedId: latest?.id })}
      title={`${endpoint.summary}. Click to inspect requests and responses.`}
      className="inline-flex max-w-full items-center gap-1.5 rounded border border-surface-line bg-surface-base px-1.5 py-0.5 font-mono text-[11px] text-ink-muted hover:border-primary hover:text-ink"
    >
      <MethodTag method={endpoint.method} />
      <span className="truncate">{endpoint.path}</span>
      {latest && (
        <span className={clsx(latest.state === "error" ? "text-short" : "text-long")}>
          {latest.status} · {latest.durationMs}ms
        </span>
      )}
    </button>
  );
}

export function ApiBadge({ endpoints, source }: { endpoints: EndpointId[]; source?: UiSource }) {
  return (
    <div className="flex flex-wrap gap-1">
      {endpoints.map((endpointId) => (
        <ApiBadgeItem key={endpointId} endpointId={endpointId} source={source} />
      ))}
    </div>
  );
}
