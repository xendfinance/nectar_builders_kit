import type { ApiErrorBody } from "./types";

/** Codes produced by the client itself rather than the backend. */
export const CLIENT_ERROR_CODES = {
  NETWORK_ERROR: "NETWORK_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
} as const;

export class ApiError extends Error {
  /** HTTP status; 0 when the request never got a response. */
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor({ status, code, message, body }: { status: number; code: string; message: string; body?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorBody).code === "string" &&
    typeof (value as ApiErrorBody).message === "string"
  );
}

export function apiErrorFromResponse(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) {
    return new ApiError({ status, code: body.code, message: body.message, body });
  }
  return new ApiError({ status, code: `HTTP_${status}`, message: `Request failed with status ${status}`, body });
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
