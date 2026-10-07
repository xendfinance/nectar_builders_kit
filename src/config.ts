/**
 * Everything a builder changes when forking lives here or in `.env` (see `.env.example`).
 */

export type ApiMode = "mock" | "live";

/** "mock" serves every request from the in-browser mock backend (`src/mock`). "live" calls the Nectar API. */
export const API_MODE: ApiMode = import.meta.env.VITE_API_MODE === "live" ? "live" : "mock";

export const API_BASE_URL = (import.meta.env.VITE_NECTAR_API_URL || "http://localhost:3333").replace(/\/+$/, "");

/** Demo builder "PerpDesk" in the mock backend. Replace with the builder ID Nectar issues you. */
export const DEMO_BUILDER_ID = "b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidBuilderId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** The builder this deployment attributes sign-ins to. */
export const DEPLOYMENT_BUILDER_ID: string | undefined = isValidBuilderId(import.meta.env.VITE_BUILDER_ID)
  ? import.meta.env.VITE_BUILDER_ID
  : API_MODE === "mock"
    ? DEMO_BUILDER_ID
    : undefined;

/** AssetChain testnet. */
export const CHAIN_ID = 42421;

/** Builder Fee API spec §13 recommendation; the backend stays authoritative. Used for form validation only. */
export const PROTOCOL_MAX_CAP_BPS = 10;

/** Slippage applied to the mark price when computing `acceptablePrice` for market orders. */
export const DEFAULT_SLIPPAGE_BPS = 30;

/** Poll intervals in ms. Polling can be paused from the API Inspector. */
export const POLL_MS = {
  tickers: 5_000,
  candles: 15_000,
  orderbook: 5_000,
  trades: 5_000,
  orders: 5_000,
} as const;
