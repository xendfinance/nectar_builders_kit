import type { TransportRequest, TransportResponse } from "@/api/transport";

import type { MockDb, MockSession } from "./db";

/**
 * Error codes the mock returns that the Builder Fee spec does not name. A real backend may use different codes
 * for these cases; the spec codes live in `ERROR_CODES` (src/api/types.ts).
 */
export const MOCK_ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_NONCE: "INVALID_NONCE",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  INVALID_PARAMS: "INVALID_PARAMS",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export interface RouteContext {
  db: MockDb;
  request: TransportRequest;
  params: Record<string, string>;
  now: number;
  siwe: { domain: string; uri: string };
}

export type RouteHandler = (context: RouteContext) => TransportResponse | Promise<TransportResponse>;

export function ok(body: unknown, status = 200): TransportResponse {
  return { status, body };
}

export function requireSession(context: RouteContext): MockSession {
  const header = context.request.headers.Authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  const session = token === undefined ? undefined : context.db.sessions.get(token);

  if (!session || session.expiresAtMs <= context.now) {
    throw new HttpError(401, MOCK_ERROR_CODES.UNAUTHORIZED, "Sign in first: missing or expired session token");
  }
  return session;
}

/** Reads a body that must be a JSON object. */
export function readBody(context: RouteContext): Record<string, unknown> {
  const { body } = context.request;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function readOptionalInt(
  query: Record<string, string>,
  name: string,
  { min, max }: { min?: number; max?: number } = {}
): number | undefined {
  const raw = query[name];
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || (min !== undefined && value < min) || (max !== undefined && value > max)) {
    const range = [min !== undefined ? `>= ${min}` : "", max !== undefined ? `<= ${max}` : ""].filter(Boolean);
    throw new HttpError(
      400,
      MOCK_ERROR_CODES.INVALID_PARAMS,
      `"${name}" must be an integer${range.length ? ` ${range.join(" and ")}` : ""}`
    );
  }
  return value;
}

export function readEnum<T extends string>(
  query: Record<string, string>,
  name: string,
  options: readonly T[]
): T | undefined {
  const raw = query[name];
  if (raw === undefined) {
    return undefined;
  }
  if (!(options as readonly string[]).includes(raw)) {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, `"${name}" must be one of: ${options.join(", ")}`);
  }
  return raw as T;
}
