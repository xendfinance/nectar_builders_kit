import type { Transport, TransportResponse } from "@/api/transport";

import { createMockDb, settleDueOrders } from "./db";
import type { MockDb } from "./db";
import { MOCK_SEED } from "./fixtures";
import { HttpError, MOCK_ERROR_CODES } from "./http";
import { PriceFeed } from "./priceFeed";
import { createRouter } from "./router";
import { authRoutes } from "./routes/auth";
import { builderRoutes } from "./routes/builder";
import { marketRoutes } from "./routes/market";
import { orderRoutes } from "./routes/orders";

export interface MockServerOptions {
  now?: () => number;
  seed?: number;
  /** Simulated network latency range in ms. 0 answers synchronously (tests). */
  latencyMs?: { min: number; max: number } | 0;
  /** Values the SIWE challenge carries and /auth/verify checks. In the browser: the page's own host and origin. */
  siwe?: { domain: string; uri: string };
}

export interface MockServer {
  transport: Transport;
  db: MockDb;
}

/** Round-trips through JSON, exactly as a value does over the wire (drops undefined, rejects bigint). */
function overTheWire<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * An in-browser stand-in for the Nectar API. It implements the `Transport` interface, so the client, the hooks and
 * the UI run exactly the code they will run against the real backend.
 */
export function createMockServer({
  now = Date.now,
  seed = MOCK_SEED,
  latencyMs = { min: 120, max: 450 },
  siwe = { domain: "localhost", uri: "http://localhost" },
}: MockServerOptions = {}): MockServer {
  const startedAt = now();
  const feed = new PriceFeed(startedAt, seed);
  const db = createMockDb(feed, startedAt, seed);
  const match = createRouter([...authRoutes, ...marketRoutes, ...orderRoutes, ...builderRoutes]);

  const transport: Transport = async (request) => {
    if (latencyMs !== 0) {
      await delay(latencyMs.min + Math.random() * (latencyMs.max - latencyMs.min));
    }

    const route = match(request);
    if (!route) {
      return {
        status: 404,
        body: { code: MOCK_ERROR_CODES.NOT_FOUND, message: `No route for ${request.method} ${request.path}` },
      };
    }

    const requestTime = now();
    // The simulated keeper runs before every request, so reads always see fills that are due.
    settleDueOrders(db, requestTime);

    let response: TransportResponse;
    try {
      const wireRequest = { ...request, body: overTheWire(request.body) };
      response = await route.handler({ db, request: wireRequest, params: route.params, now: requestTime, siwe });
    } catch (error) {
      if (error instanceof HttpError) {
        return { status: error.status, body: { code: error.code, message: error.message } };
      }
      console.error("[mock] unhandled error", error);
      return { status: 500, body: { code: MOCK_ERROR_CODES.INTERNAL_ERROR, message: String(error) } };
    }

    // A serialized copy, so nothing the UI does to a response can change server state.
    return { status: response.status, body: overTheWire(response.body) };
  };

  return { transport, db };
}
