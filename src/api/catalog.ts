import type { HttpMethod } from "./transport";

/**
 * Single registry of every endpoint the interface calls. The client resolves method + path from here, the API
 * Explorer renders its forms from here, and the UI tags each request with a `UiSource` so the API Inspector can
 * show which panel made it.
 */

/** Where in the interface a request comes from. Every request carries one of these as its `source`. */
export const UI_SOURCES = {
  headerWallet: { label: "Header › Wallet & sign-in", route: "/trade" },
  tradeMarketHeader: { label: "Trade › Market header", route: "/trade" },
  tradeChart: { label: "Trade › Price chart", route: "/trade" },
  tradeOrderbook: { label: "Trade › Order book", route: "/trade" },
  tradeRecentTrades: { label: "Trade › Recent trades", route: "/trade" },
  tradeOrderForm: { label: "Trade › Order form", route: "/trade" },
  tradeOrders: { label: "Trade › Orders", route: "/trade" },
  builderProfile: { label: "Builder › Profile", route: "/builder" },
  builderStats: { label: "Builder › Stats", route: "/builder" },
  builderFeesChart: { label: "Builder › Fees chart", route: "/builder" },
  builderUsers: { label: "Builder › Users", route: "/builder" },
  builderTrades: { label: "Builder › Trades", route: "/builder" },
  builderSettings: { label: "Builder › Settings", route: "/builder" },
  explorer: { label: "API Explorer", route: "/explorer" },
} as const;

export type UiSource = keyof typeof UI_SOURCES;

export type EndpointGroup = "auth" | "market" | "account" | "orders" | "builder";

export const ENDPOINT_GROUPS: Record<EndpointGroup, string> = {
  auth: "Auth (SIWE)",
  market: "Market data",
  account: "Account",
  orders: "Orders (fee injection)",
  builder: "Builder dashboard",
};

/** none: public. session: Bearer token from /auth/verify. builder: session whose wallet is a registered builder. */
export type AuthRequirement = "none" | "session" | "builder";

export interface ParamSpec {
  name: string;
  in: "path" | "query";
  type: "string" | "number" | "enum";
  required?: boolean;
  options?: readonly string[];
  description: string;
}

/** Live values the API Explorer uses to pre-fill example inputs. */
export interface ExampleContext {
  address: string;
  builderId?: string;
  marketKey: string;
  collateralToken: string;
  tokenSymbol: string;
  lastPreparedOrderId?: string;
}

export interface ExampleInput {
  path?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface EndpointDef {
  id: EndpointId;
  group: EndpointGroup;
  method: HttpMethod;
  /** Path template; `:name` segments are filled from `path` params. */
  path: string;
  summary: string;
  description: string;
  auth: AuthRequirement;
  params: ParamSpec[];
  /** Name of the response type in `src/api/types.ts`. */
  responseType: string;
  /** Name of the request body type in `src/api/types.ts`, when there is a body. */
  bodyType?: string;
  usedIn: UiSource[];
  example: (context: ExampleContext) => ExampleInput;
  notes?: string[];
}

export type EndpointId =
  | "auth.nonce"
  | "auth.verify"
  | "auth.session"
  | "oracle.tickers"
  | "oracle.24h"
  | "oracle.candles"
  | "market.orderbook"
  | "market.trades"
  | "account.orders"
  | "orders.prepare"
  | "orders.submit"
  | "builder.me"
  | "builder.stats"
  | "builder.users"
  | "builder.trades"
  | "builder.update";

const PAGINATION_PARAMS: ParamSpec[] = [
  { name: "page", in: "query", type: "number", description: "1-based page number. Default 1." },
  { name: "pageSize", in: "query", type: "number", description: "Items per page, 1–100. Default 20." },
];

const PERIOD_OPTIONS = ["all", "30d", "7d", "24h"] as const;

export const ENDPOINTS: Record<EndpointId, EndpointDef> = {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  "auth.nonce": {
    id: "auth.nonce",
    group: "auth",
    method: "GET",
    path: "/auth/nonce",
    summary: "Request a SIWE challenge",
    description:
      "Step 1 of sign-in. Passing builderId stamps the builder on the challenge, so the session (and every order it prepares) is attributed to that builder. An unknown or frozen builder is rejected; the client then retries without builderId so the trader is never locked out.",
    auth: "none",
    params: [
      { name: "address", in: "query", type: "string", required: true, description: "Wallet address (EIP-55)." },
      { name: "builderId", in: "query", type: "string", description: "Builder UUID to attribute the session to." },
    ],
    responseType: "NonceResponse",
    usedIn: ["headerWallet"],
    example: ({ address, builderId }) => {
      const query: Record<string, string> = { address };
      if (builderId !== undefined) {
        query.builderId = builderId;
      }
      return { query };
    },
    notes: ["Errors: 404 UNKNOWN_BUILDER, 403 BUILDER_FROZEN."],
  },
  "auth.verify": {
    id: "auth.verify",
    group: "auth",
    method: "POST",
    path: "/auth/verify",
    summary: "Exchange a signed SIWE message for a session",
    description:
      "Step 2 of sign-in. The client builds the EIP-4361 message from the challenge, the wallet signs it (personal_sign), and the backend returns a Bearer token.",
    auth: "none",
    params: [],
    bodyType: "VerifyPayload",
    responseType: "VerifyResponse",
    usedIn: ["headerWallet"],
    example: () => ({ body: { message: "<EIP-4361 message from the challenge>", signature: "0x…" } }),
    notes: ["Sign in from the header to see a real message and signature in the API Inspector."],
  },
  "auth.session": {
    id: "auth.session",
    group: "auth",
    method: "GET",
    path: "/auth",
    summary: "Read the current session",
    description:
      "Returns the signed-in wallet and the builder attribution resolved at sign-in (builderId, builderName, builderFeeRateBps). The order form uses it to show which builder fee applies before an order is prepared.",
    auth: "session",
    params: [],
    responseType: "AuthSessionResponse",
    usedIn: ["headerWallet", "tradeOrderForm"],
    example: () => ({}),
  },

  // ─── Market data ───────────────────────────────────────────────────────────
  "oracle.tickers": {
    id: "oracle.tickers",
    group: "market",
    method: "GET",
    path: "/oracle-keeper/prices/tickers",
    summary: "Latest min/max oracle prices",
    description:
      "Prices are integer strings equal to USD price × 10^oracleDecimals. The mark price shown in the UI is the midpoint of minPrice and maxPrice.",
    auth: "none",
    params: [
      { name: "symbols", in: "query", type: "string", description: "Comma-separated token symbols, e.g. WETH,WBTC." },
    ],
    responseType: "TickerItem[]",
    usedIn: ["tradeMarketHeader", "tradeOrderForm"],
    example: () => ({ query: { symbols: "WETH,WBTC,CNGN" } }),
  },
  "oracle.24h": {
    id: "oracle.24h",
    group: "market",
    method: "GET",
    path: "/oracle-keeper/prices/24h",
    summary: "24-hour open/high/low/close",
    description: "Drives the 24h change, high and low in the market header.",
    auth: "none",
    params: [{ name: "symbols", in: "query", type: "string", description: "Comma-separated token symbols." }],
    responseType: "DayCandleItem[]",
    usedIn: ["tradeMarketHeader"],
    example: () => ({ query: { symbols: "WETH,WBTC,CNGN" } }),
  },
  "oracle.candles": {
    id: "oracle.candles",
    group: "market",
    method: "GET",
    path: "/oracle-keeper/prices/candles",
    summary: "OHLC candles for the price chart",
    description:
      "Each candle is a tuple [timestamp, open, high, low, close] with the timestamp in unix seconds at the bucket start, oldest first.",
    auth: "none",
    params: [
      { name: "tokenSymbol", in: "query", type: "string", required: true, description: "Index token symbol." },
      {
        name: "period",
        in: "query",
        type: "enum",
        required: true,
        options: ["1m", "5m", "15m", "1h", "4h", "1d"],
        description: "Candle width.",
      },
      { name: "limit", in: "query", type: "number", description: "Number of candles, newest last." },
    ],
    responseType: "CandlesResponse",
    usedIn: ["tradeChart"],
    example: ({ tokenSymbol }) => ({ query: { tokenSymbol, period: "15m", limit: "200" } }),
  },
  "market.orderbook": {
    id: "market.orderbook",
    group: "market",
    method: "GET",
    path: "/orderbooks/:symbol",
    summary: "Aggregated order book",
    description: "Bids (descending) and asks (ascending) around the current price, with cumulative size per level.",
    auth: "none",
    params: [
      { name: "symbol", in: "path", type: "string", required: true, description: "Index token symbol." },
      { name: "limit", in: "query", type: "number", description: "Levels per side." },
    ],
    responseType: "OrderbookResponse",
    usedIn: ["tradeOrderbook"],
    example: ({ tokenSymbol }) => ({ path: { symbol: tokenSymbol }, query: { limit: "12" } }),
  },
  "market.trades": {
    id: "market.trades",
    group: "market",
    method: "GET",
    path: "/trades/:symbol",
    summary: "Recent trades",
    description: "Newest first. The response has no side field, so the UI colours each trade by tick direction.",
    auth: "none",
    params: [
      { name: "symbol", in: "path", type: "string", required: true, description: "Index token symbol." },
      { name: "limit", in: "query", type: "number", description: "Number of trades." },
    ],
    responseType: "RecentTradeItem[]",
    usedIn: ["tradeRecentTrades"],
    example: ({ tokenSymbol }) => ({ path: { symbol: tokenSymbol }, query: { limit: "20" } }),
  },

  // ─── Account ───────────────────────────────────────────────────────────────
  "account.orders": {
    id: "account.orders",
    group: "account",
    method: "GET",
    path: "/accounts/:account/orders",
    summary: "Orders for an account",
    description:
      "Open, executed and cancelled orders. Orders submitted through /orders/submit appear here as OPEN and turn EXECUTED once a keeper fills them.",
    auth: "none",
    params: [{ name: "account", in: "path", type: "string", required: true, description: "Wallet address." }],
    responseType: "AccountOrderItem[]",
    usedIn: ["tradeOrders"],
    example: ({ address }) => ({ path: { account: address } }),
  },

  // ─── Orders ────────────────────────────────────────────────────────────────
  "orders.prepare": {
    id: "orders.prepare",
    group: "orders",
    method: "POST",
    path: "/orders/prepare",
    summary: "Build an order with fees injected",
    description:
      "The client sends what to trade, never the fees. The backend looks up the session's builder, injects the base fee and builder fee, and returns an EIP-712 payload plus a human-readable fee breakdown. The quote expires at expiresAt.",
    auth: "session",
    params: [],
    bodyType: "PrepareOrderPayload",
    responseType: "PrepareOrderResponse",
    usedIn: ["tradeOrderForm"],
    example: ({ marketKey, collateralToken }) => ({
      body: {
        marketKey,
        collateralToken,
        sizeDeltaUsd: "1000000000000000000000000000000000",
        isLong: true,
        orderType: 2,
      },
    }),
    notes: [
      "sizeDeltaUsd above is $1,000 (1000 × 1e30).",
      "Errors: 400 INVALID_MARKET, INVALID_SIZE, INVALID_ORDER_TYPE.",
    ],
  },
  "orders.submit": {
    id: "orders.submit",
    group: "orders",
    method: "POST",
    path: "/orders/submit",
    summary: "Submit the signed order",
    description:
      "Sends the wallet's EIP-712 signature over the payload exactly as prepared. Any client-side change to the payload (fees included) fails with SIGNATURE_MISMATCH.",
    auth: "session",
    params: [],
    bodyType: "SubmitOrderPayload",
    responseType: "SubmitOrderResponse",
    usedIn: ["tradeOrderForm"],
    example: ({ lastPreparedOrderId }) => ({
      body: { orderId: lastPreparedOrderId ?? "<orderId from /orders/prepare>", signature: "0x…" },
    }),
    notes: ["Errors: 404 ORDER_NOT_FOUND, 409 ORDER_ALREADY_SUBMITTED, 410 ORDER_EXPIRED, 400 SIGNATURE_MISMATCH."],
  },

  // ─── Builder dashboard ─────────────────────────────────────────────────────
  "builder.me": {
    id: "builder.me",
    group: "builder",
    method: "GET",
    path: "/builders/me",
    summary: "Your builder profile",
    description: "Profile and stats buckets (all time, 30d, 7d, 24h) for the builder whose wallet owns the session.",
    auth: "builder",
    params: [],
    responseType: "BuilderProfileResponse",
    usedIn: ["builderProfile", "builderSettings"],
    example: () => ({}),
    notes: ["Errors: 403 NOT_A_BUILDER when the signed-in wallet is not a registered builder."],
  },
  "builder.stats": {
    id: "builder.stats",
    group: "builder",
    method: "GET",
    path: "/builders/me/stats",
    summary: "Stats for one period",
    description: "Trade count, volume, builder fees earned, base fees passed through to the protocol, unique users.",
    auth: "builder",
    params: [
      { name: "period", in: "query", type: "enum", options: PERIOD_OPTIONS, description: "Default all." },
      { name: "chainId", in: "query", type: "number", description: "Filter to one chain." },
    ],
    responseType: "BuilderStatsResponse",
    usedIn: ["builderStats"],
    example: () => ({ query: { period: "7d" } }),
  },
  "builder.users": {
    id: "builder.users",
    group: "builder",
    method: "GET",
    path: "/builders/me/users",
    summary: "Users attributed to you",
    description: "One row per trader whose sessions were attributed to your builder ID.",
    auth: "builder",
    params: [
      {
        name: "sortBy",
        in: "query",
        type: "enum",
        options: ["volumeUsd", "tradeCount", "feeGenerated", "firstSeen"],
        description: "Default volumeUsd.",
      },
      { name: "order", in: "query", type: "enum", options: ["desc", "asc"], description: "Default desc." },
      ...PAGINATION_PARAMS,
    ],
    responseType: "BuilderUsersResponse",
    usedIn: ["builderUsers"],
    example: () => ({ query: { sortBy: "feeGenerated", order: "desc", page: "1", pageSize: "10" } }),
  },
  "builder.trades": {
    id: "builder.trades",
    group: "builder",
    method: "GET",
    path: "/builders/me/trades",
    summary: "Trades attributed to you",
    description:
      "Settled trades with the fee split per trade, newest first. The fees chart pages through this endpoint and buckets the trades client-side, because the spec has no time-series endpoint.",
    auth: "builder",
    params: [
      { name: "account", in: "query", type: "string", description: "Filter to one trader." },
      { name: "fromTimestamp", in: "query", type: "number", description: "Unix seconds, inclusive." },
      { name: "toTimestamp", in: "query", type: "number", description: "Unix seconds, inclusive." },
      { name: "chainId", in: "query", type: "number", description: "Filter to one chain." },
      ...PAGINATION_PARAMS,
    ],
    responseType: "BuilderTradesResponse",
    usedIn: ["builderFeesChart", "builderTrades"],
    example: () => ({ query: { page: "1", pageSize: "10" } }),
  },
  "builder.update": {
    id: "builder.update",
    group: "builder",
    method: "PATCH",
    path: "/builders/:builderId",
    summary: "Update your fee rate or details",
    description:
      "A builder may change feeRateBps (0 up to its feeCapBps), contactEmail and description. feeCapBps, walletAddress and status are admin-only.",
    auth: "builder",
    params: [{ name: "builderId", in: "path", type: "string", required: true, description: "Your builder UUID." }],
    bodyType: "UpdateBuilderPayload",
    responseType: "UpdateBuilderResponse",
    usedIn: ["builderSettings"],
    example: ({ builderId }) => ({ path: { builderId: builderId ?? "" }, body: { feeRateBps: 4 } }),
    notes: ["Errors: 400 INVALID_FEE_RATE, 403 FORBIDDEN (another builder, or an admin-only field)."],
  },
};

export const ENDPOINT_LIST: EndpointDef[] = Object.values(ENDPOINTS);

/** Fills `:name` segments. Throws when a required segment is missing so a bad call never reaches the network. */
export function resolvePath(template: string, params: Record<string, string> = {}): string {
  return template.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined || value === "") {
      throw new Error(`Missing path parameter "${name}" for ${template}`);
    }
    return encodeURIComponent(value);
  });
}
