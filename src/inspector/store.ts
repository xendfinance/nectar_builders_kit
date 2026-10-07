import { useSyncExternalStore } from "react";

import type { EndpointId, UiSource } from "@/api/catalog";
import type { HttpMethod } from "@/api/transport";

/** One request/response pair as the API Inspector shows it. */
export interface ApiCallRecord {
  id: number;
  endpointId: EndpointId;
  source: UiSource;
  method: HttpMethod;
  /** Path with the query string, e.g. `/builders/me/stats?period=7d`. */
  path: string;
  url: string;
  transport: "mock" | "live";
  startedAt: number;
  durationMs?: number;
  state: "pending" | "success" | "error";
  status?: number;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  errorMessage?: string;
}

export interface InspectorState {
  records: ApiCallRecord[];
  isOpen: boolean;
  selectedId?: number;
  endpointFilter?: EndpointId;
  /** When false, polling queries stop refetching (see `usePollInterval`). */
  isPolling: boolean;
}

const MAX_RECORDS = 300;

let state: InspectorState = { records: [], isOpen: false, isPolling: true };
let nextId = 1;
const listeners = new Set<() => void>();

function setState(update: (current: InspectorState) => InspectorState) {
  state = update(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const inspector = {
  getState: () => state,

  start(record: Omit<ApiCallRecord, "id" | "state" | "startedAt">): number {
    const id = nextId++;
    setState((current) => ({
      ...current,
      records: [{ ...record, id, state: "pending" as const, startedAt: Date.now() }, ...current.records].slice(
        0,
        MAX_RECORDS
      ),
    }));
    return id;
  },

  finish(id: number, result: Pick<ApiCallRecord, "status" | "responseBody" | "errorMessage">) {
    setState((current) => ({
      ...current,
      records: current.records.map((record) =>
        record.id === id
          ? {
              ...record,
              ...result,
              durationMs: Date.now() - record.startedAt,
              state: result.errorMessage === undefined ? ("success" as const) : ("error" as const),
            }
          : record
      ),
    }));
  },

  open(options: { endpointFilter?: EndpointId; selectedId?: number } = {}) {
    setState((current) => ({
      ...current,
      isOpen: true,
      endpointFilter: options.endpointFilter,
      selectedId: options.selectedId ?? current.selectedId,
    }));
  },

  toggle() {
    setState((current) => ({ ...current, isOpen: !current.isOpen }));
  },

  select(selectedId: number | undefined) {
    setState((current) => ({ ...current, selectedId }));
  },

  setEndpointFilter(endpointFilter: EndpointId | undefined) {
    setState((current) => ({ ...current, endpointFilter }));
  },

  setPolling(isPolling: boolean) {
    setState((current) => ({ ...current, isPolling }));
  },

  clear() {
    setState((current) => ({ ...current, records: [], selectedId: undefined }));
  },
};

export function useInspector<T>(selector: (state: InspectorState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/** Latest finished call for an endpoint, optionally from one source. Used by the API badges. */
export function selectLatestCall(endpointId: EndpointId, source?: UiSource) {
  return (current: InspectorState) =>
    current.records.find(
      (record) =>
        record.endpointId === endpointId && record.state !== "pending" && (!source || record.source === source)
    );
}
