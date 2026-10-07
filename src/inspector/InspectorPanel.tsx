import clsx from "clsx";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ENDPOINT_GROUPS, ENDPOINTS, UI_SOURCES } from "@/api/catalog";
import type { EndpointGroup } from "@/api/catalog";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { JsonView } from "@/components/JsonView";
import { MethodTag } from "@/components/MethodTag";
import { Segmented } from "@/components/Segmented";
import { API_MODE } from "@/config";
import { toCurl } from "@/lib/curl";
import { formatTime } from "@/lib/format";

import { inspector, useInspector } from "./store";
import type { ApiCallRecord } from "./store";

type DetailTab = "response" | "request" | "curl";
type GroupFilter = EndpointGroup | "all";

const GROUP_OPTIONS: { value: GroupFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...(Object.keys(ENDPOINT_GROUPS) as EndpointGroup[]).map((group) => ({
    value: group,
    label: ENDPOINT_GROUPS[group],
  })),
];

function StatusText({ record }: { record: ApiCallRecord }) {
  if (record.state === "pending") {
    return <span className="text-ink-faint">…</span>;
  }
  return <span className={record.state === "error" ? "text-short" : "text-long"}>{record.status || "ERR"}</span>;
}

function RecordDetail({ record }: { record: ApiCallRecord }) {
  const [tab, setTab] = useState<DetailTab>("response");
  const endpoint = ENDPOINTS[record.endpointId];
  const source = UI_SOURCES[record.source];
  const curl = toCurl({
    method: record.method,
    url: record.url,
    hasAuth: record.requestHeaders.Authorization !== undefined,
    body: record.requestBody,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <MethodTag method={record.method} />
          <span className="break-all text-ink">{record.path}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span>
            Status <StatusText record={record} />
          </span>
          {record.durationMs !== undefined && <span>{record.durationMs} ms</span>}
          <span>
            From{" "}
            <Link className="text-ink underline decoration-ink-faint hover:decoration-ink" to={source.route}>
              {source.label}
            </Link>
          </span>
          <Link
            className="text-ink underline decoration-ink-faint hover:decoration-ink"
            to={`/explorer/${record.endpointId}`}
          >
            {endpoint.summary} → API Explorer
          </Link>
        </div>
        {record.errorMessage && <p className="font-mono text-xs text-short">{record.errorMessage}</p>}
      </div>

      <Segmented
        ariaLabel="Request detail"
        value={tab}
        onChange={setTab}
        options={[
          { value: "response", label: `Response · ${endpoint.responseType}` },
          { value: "request", label: "Request" },
          { value: "curl", label: "cURL" },
        ]}
      />

      {tab === "response" && <JsonView value={record.responseBody} />}
      {tab === "request" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-muted">Headers</p>
          <JsonView value={record.requestHeaders} />
          <p className="text-xs text-ink-muted">Body{endpoint.bodyType ? ` · ${endpoint.bodyType}` : ""}</p>
          <JsonView value={record.requestBody} />
        </div>
      )}
      {tab === "curl" && (
        <div className="flex flex-col items-start gap-2">
          <CopyButton text={curl} label="Copy cURL" />
          <JsonViewPlain text={curl} />
          {API_MODE === "mock" && (
            <p className="text-xs text-ink-faint">
              Mock mode: this request was answered in the browser. The command targets the configured
              VITE_NECTAR_API_URL.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function JsonViewPlain({ text }: { text: string }) {
  return (
    <pre className="w-full overflow-auto whitespace-pre rounded-md bg-surface-base p-3 font-mono text-[12px] leading-5 text-ink-muted">
      {text}
    </pre>
  );
}

export function InspectorPanel() {
  const records = useInspector((state) => state.records);
  const isOpen = useInspector((state) => state.isOpen);
  const selectedId = useInspector((state) => state.selectedId);
  const endpointFilter = useInspector((state) => state.endpointFilter);
  const isPolling = useInspector((state) => state.isPolling);
  const [group, setGroup] = useState<GroupFilter>("all");

  const visible = useMemo(
    () =>
      records.filter(
        (record) =>
          (endpointFilter === undefined || record.endpointId === endpointFilter) &&
          (group === "all" || ENDPOINTS[record.endpointId].group === group)
      ),
    [records, endpointFilter, group]
  );
  const selected = visible.find((record) => record.id === selectedId) ?? visible[0];

  return (
    <div
      className={clsx(
        "fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-surface-line bg-surface-card shadow-2xl",
        isOpen ? "h-[48vh]" : "h-10"
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-3 px-3">
        <button
          type="button"
          onClick={() => inspector.toggle()}
          className="flex items-center gap-2 text-sm font-semibold text-ink"
          aria-expanded={isOpen}
        >
          <span className={clsx("inline-block transition-transform", isOpen ? "rotate-180" : "")}>▴</span>
          API Inspector
          <span className="rounded bg-surface-raised px-1.5 text-xs font-normal text-ink-muted">{records.length}</span>
        </button>
        <span className="hidden text-xs text-ink-faint md:inline">
          Every request this interface makes, with the data it got back.
        </span>
        {isOpen && (
          <div className="ml-auto flex items-center gap-2">
            {endpointFilter && (
              <Button size="sm" variant="secondary" onClick={() => inspector.setEndpointFilter(undefined)}>
                {ENDPOINTS[endpointFilter].path} ×
              </Button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={isPolling}
                onChange={(event) => inspector.setPolling(event.target.checked)}
              />
              Live polling
            </label>
            <Button size="sm" variant="ghost" onClick={() => inspector.clear()}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-surface-line">
          <div className="overflow-x-auto px-3 py-2">
            <Segmented ariaLabel="Endpoint group" value={group} onChange={setGroup} options={GROUP_OPTIONS} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <ol className="min-h-0 overflow-auto border-surface-line md:w-[46%] md:border-r">
              {visible.length === 0 && <li className="p-4 text-sm text-ink-faint">No requests yet.</li>}
              {visible.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => inspector.select(record.id)}
                    className={clsx(
                      "grid w-full grid-cols-[64px_44px_1fr_40px_52px] items-center gap-2 px-3 py-1.5 text-left font-mono text-[11px]",
                      record.id === selected?.id ? "bg-surface-raised" : "hover:bg-surface-raised/60"
                    )}
                  >
                    <span className="text-ink-faint">{formatTime(record.startedAt)}</span>
                    <MethodTag method={record.method} />
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{record.path}</span>
                      <span className="block truncate font-sans text-ink-faint">{UI_SOURCES[record.source].label}</span>
                    </span>
                    <StatusText record={record} />
                    <span className="text-right text-ink-faint">
                      {record.durationMs !== undefined ? `${record.durationMs}ms` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {selected ? (
              <RecordDetail key={selected.id} record={selected} />
            ) : (
              <div className="flex-1 p-4 text-sm text-ink-faint">Select a request to see its data.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
