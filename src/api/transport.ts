import { API_BASE_URL } from "@/config";

import { ApiError, CLIENT_ERROR_CODES } from "./errors";

export type HttpMethod = "GET" | "POST" | "PATCH";

/** One HTTP request, already resolved: path params filled in, query values stringified. */
export interface TransportRequest {
  method: HttpMethod;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: unknown;
}

export interface TransportResponse {
  status: number;
  body: unknown;
}

/**
 * The seam between the UI and the backend. The client never knows which one it talks to:
 * `httpTransport` calls the real API, `src/mock/server.ts` answers in-browser with the same wire format.
 */
export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

export function buildQueryString(query: Record<string, string>): string {
  const search = new URLSearchParams(query).toString();
  return search ? `?${search}` : "";
}

export function buildUrl(path: string, query: Record<string, string>): string {
  return `${API_BASE_URL}${path}${buildQueryString(query)}`;
}

export const httpTransport: Transport = async ({ method, path, query, headers, body }) => {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError({
      status: 0,
      code: CLIENT_ERROR_CODES.NETWORK_ERROR,
      message: `Could not reach ${API_BASE_URL}. Check VITE_NECTAR_API_URL and CORS. (${String(error)})`,
    });
  }

  const text = await response.text();
  if (text === "") {
    return { status: response.status, body: null };
  }

  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    // A dev server or proxy answering with HTML must not be mistaken for API data.
    throw new ApiError({
      status: response.status,
      code: CLIENT_ERROR_CODES.INVALID_RESPONSE,
      message: `Expected JSON from ${path} but received ${response.headers.get("content-type") ?? "an unknown type"}.`,
      body: text.slice(0, 500),
    });
  }
};
