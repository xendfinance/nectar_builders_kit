import { API_MODE } from "@/config";
import { inspector } from "@/inspector/store";

import { ENDPOINTS, resolvePath } from "./catalog";
import type { EndpointId, UiSource } from "./catalog";
import { ApiError, apiErrorFromResponse } from "./errors";
import { buildQueryString, buildUrl, httpTransport } from "./transport";
import type { Transport, TransportResponse } from "./transport";

export interface CallOptions {
  source: UiSource;
  path?: Record<string, string>;
  /** Undefined, null and empty-string values are dropped, so optional filters never send "undefined". */
  query?: object;
  body?: unknown;
}

let transport: Transport = httpTransport;
let accessToken: string | undefined;

/** Installed once at startup (`src/main.tsx`): the mock server in mock mode, `httpTransport` in live mode. */
export function setTransport(next: Transport) {
  transport = next;
}

/** Set after /auth/verify succeeds and cleared on sign-out. Sent as `Authorization: Bearer` on authed endpoints. */
export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

export function toQueryRecord(query: object | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      result[key] = String(value);
    }
  }
  return result;
}

/** Keeps tokens out of the on-screen inspector; copied cURL commands use a $NECTAR_TOKEN placeholder instead. */
function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const authorization = headers.Authorization;
  if (authorization === undefined) {
    return headers;
  }
  return { ...headers, Authorization: `${authorization.slice(0, 18)}…` };
}

/**
 * Every request in the interface goes through here: resolve the endpoint from the catalog, attach auth,
 * record the call in the API Inspector, and turn non-2xx responses into `ApiError`s.
 */
export async function callEndpoint<T>(endpointId: EndpointId, options: CallOptions): Promise<T> {
  const endpoint = ENDPOINTS[endpointId];
  const path = resolvePath(endpoint.path, options.path);
  const query = toQueryRecord(options.query);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (endpoint.auth !== "none" && accessToken !== undefined) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const recordId = inspector.start({
    endpointId,
    source: options.source,
    method: endpoint.method,
    path: `${path}${buildQueryString(query)}`,
    url: buildUrl(path, query),
    transport: API_MODE,
    requestHeaders: redactHeaders(headers),
    requestBody: options.body,
  });

  let response: TransportResponse;
  try {
    response = await transport({ method: endpoint.method, path, query, headers, body: options.body });
  } catch (error) {
    // Transport-level failure: network error, or a body that is not JSON.
    inspector.finish(recordId, {
      status: error instanceof ApiError ? error.status : 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (response.status >= 400) {
    const error = apiErrorFromResponse(response.status, response.body);
    inspector.finish(recordId, {
      status: response.status,
      responseBody: response.body,
      errorMessage: `${error.code}: ${error.message}`,
    });
    throw error;
  }

  inspector.finish(recordId, { status: response.status, responseBody: response.body });
  return response.body as T;
}
