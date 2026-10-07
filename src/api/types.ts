/**
 * Wire types for every endpoint this interface calls.
 *
 * Builder, auth and order shapes follow the "Nectar Liquid — Builder Fee API Specification", the same contract the
 * main app types in `nectar-frontend/src/lib/apis/builder/types.ts`. Market-data shapes follow
 * `nectar-frontend/docs/nectar_backend_api_specs.md` and `docs/backend-api-examples.md`.
 */

// ─── Shared ──────────────────────────────────────────────────────────────────

/** Error body returned with every non-2xx response. */
export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface Paginated<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  /** Only some endpoints return it (e.g. `/builders/me/users`). */
  lastPage?: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export type StatsPeriod = "all" | "30d" | "7d" | "24h";

export type BuilderStatus = "active" | "frozen" | "blacklisted" | "rate_limited";

// ─── Auth (SIWE) ─────────────────────────────────────────────────────────────

export interface NonceParams {
  address: string;
  /** Attributes the session to a builder. Rejected with UNKNOWN_BUILDER / BUILDER_FROZEN. */
  builderId?: string;
}

/** GET /auth/nonce */
export interface NonceResponse {
  address: string;
  nonce: string;
  expiresAt: string;
  domain: string;
  uri: string;
  statement: string;
  version: string;
  chainId: number;
  /** Present when the nonce was issued with a valid `builderId`. */
  builderId?: string | null;
  builderName?: string | null;
}

/** POST /auth/verify body */
export interface VerifyPayload {
  message: string;
  signature: string;
}

export interface AuthTrader {
  id: number;
  address: string;
  referralCode: string | null;
  isNew: boolean;
}

/** POST /auth/verify */
export interface VerifyResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
  address: string;
  chainId: number;
  trader: AuthTrader;
}

/** GET /auth */
export interface AuthSessionResponse {
  address: string;
  chainId: number | null;
  trader: AuthTrader;
  /** Builder attribution resolved from the nonce at sign-in; null when the session has none. */
  builderId: string | null;
  builderName: string | null;
  builderFeeRateBps: number | null;
}

// ─── Market data (oracle keeper, order book, trades) ─────────────────────────

/** GET /oracle-keeper/prices/tickers. Prices are integer strings: USD price × 10^oracleDecimals. */
export interface TickerItem {
  minPrice: string;
  maxPrice: string;
  oracleDecimals: number;
  tokenSymbol: string;
  tokenAddress: string;
  /** Unix seconds. */
  updatedAt: number;
}

/** GET /oracle-keeper/prices/24h */
export interface DayCandleItem {
  tokenSymbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type CandlePeriod = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface CandlesParams {
  tokenSymbol: string;
  period: CandlePeriod;
  limit?: number;
}

/** [timestamp (unix seconds, bucket start), open, high, low, close] */
export type RawCandle = [number, number, number, number, number];

/** GET /oracle-keeper/prices/candles */
export interface CandlesResponse {
  candles: RawCandle[];
}

export interface OrderbookLevel {
  price: string;
  sizeInToken: string;
  totalInToken: string;
}

/** GET /orderbooks/:symbol */
export interface OrderbookResponse {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

/** GET /trades/:symbol (array, newest first) */
export interface RecentTradeItem {
  id: number;
  price: string;
  sizeInToken: string;
  createdAt: string;
}

// ─── Account ─────────────────────────────────────────────────────────────────

export type AccountOrderStatus = "OPEN" | "EXECUTED" | "CANCELLED" | "EXPIRED";

/** GET /accounts/:account/orders (array) */
export interface AccountOrderItem {
  id: number;
  key: string;
  account: string;
  /** Market token address (== marketKey). */
  market: string;
  isLong: boolean;
  /** USD × 1e30, integer string. */
  sizeDeltaUsd: string;
  /** USD × 1e30, integer string. */
  triggerPrice: string;
  status: AccountOrderStatus;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Builder dashboard (/builders/me) ────────────────────────────────────────

export interface BuilderStatsBucket {
  tradeCount: number;
  volumeUsd: number;
  builderFeeEarnedUsd: number;
  uniqueUsers: number;
}

/** GET /builders/me */
export interface BuilderProfileResponse {
  builderId: string;
  name: string;
  walletAddress: string;
  feeRateBps: number;
  feeCapBps: number;
  status: BuilderStatus;
  registeredAt: string;
  contactEmail?: string | null;
  description?: string | null;
  stats?: {
    allTime?: BuilderStatsBucket;
    last30d?: BuilderStatsBucket;
    last7d?: BuilderStatsBucket;
    last24h?: BuilderStatsBucket;
  };
}

export interface BuilderStatsParams {
  period?: StatsPeriod;
  chainId?: number;
}

/** GET /builders/me/stats */
export interface BuilderStatsResponse {
  builderId: string;
  name: string;
  feeRateBps: number;
  feeCapBps: number;
  walletAddress: string;
  stats?: {
    tradeCount: number;
    volumeUsd: number;
    builderFeeEarnedUsd: number;
    baseFeePassThroughUsd: number;
    uniqueUsers: number;
    directTrades: number;
    builderAttributedTrades: number;
  };
}

export type BuilderUsersSortBy = "volumeUsd" | "tradeCount" | "feeGenerated" | "firstSeen";

export interface BuilderUsersParams extends PaginationParams {
  sortBy?: BuilderUsersSortBy;
  order?: "asc" | "desc";
}

export interface BuilderUserItem {
  account: string;
  firstSeen: string;
  lastSeen: string;
  tradeCount: number;
  volumeUsd: number;
  builderFeeGeneratedUsd: number;
  baseFeeGeneratedUsd: number;
}

/** GET /builders/me/users */
export type BuilderUsersResponse = Paginated<BuilderUserItem>;

export interface BuilderTradesParams extends PaginationParams {
  account?: string;
  /** Unix seconds, inclusive. */
  fromTimestamp?: number;
  /** Unix seconds, inclusive. */
  toTimestamp?: number;
  chainId?: number;
}

export interface BuilderTradeItem {
  orderId: string;
  txHash: string;
  account: string;
  marketKey: string;
  marketSymbol: string;
  isLong: boolean;
  orderType: number;
  sizeDeltaUsd: number;
  baseFeeUsd: number;
  builderFeeUsd: number;
  totalFeeUsd: number;
  status: string;
  settledAt: string;
  chainId: number;
}

/** GET /builders/me/trades (no `lastPage`) */
export type BuilderTradesResponse = Paginated<BuilderTradeItem>;

/** PATCH /builders/:builderId body. A builder may change feeRateBps, contactEmail and description only. */
export interface UpdateBuilderPayload {
  feeRateBps?: number;
  contactEmail?: string;
  description?: string;
}

/** PATCH /builders/:builderId */
export interface UpdateBuilderResponse {
  builderId: string;
  feeRateBps: number;
  feeCapBps: number;
  status: BuilderStatus;
  updatedAt: string;
  changedFields: string[];
}

// ─── Order construction with fee injection (/orders) ─────────────────────────

/** POST /orders/prepare body. Fee amounts are never sent: the backend injects them. */
export interface PrepareOrderPayload {
  marketKey: string;
  collateralToken: string;
  /** USD × 1e30, integer string. */
  sizeDeltaUsd: string;
  isLong: boolean;
  orderType?: number;
  /** USD × 1e30, integer string. */
  acceptablePrice?: string;
  swapPath?: string[];
}

export interface PreparedOrderMessage {
  marketKey: string;
  collateralToken: string;
  sizeDeltaUsd: string;
  isLong: boolean;
  orderType: number;
  acceptablePrice: string;
  uiFeeReceiver: string;
  baseFeeAmountUsd: string;
  builderFeeAmountUsd: string;
  nonce: string;
  expiry: number;
}

export interface Eip712Field {
  name: string;
  type: string;
}

export interface Eip712Payload {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  /** Struct definitions. The spec does not send `EIP712Domain` or a `primaryType` (see README, "Spec notes"). */
  types: Record<string, Eip712Field[]>;
  message: PreparedOrderMessage;
}

export interface OrderFeeBreakdown {
  baseFeeRateBps: number;
  builderFeeRateBps: number;
  totalFeeRateBps: number;
  /** Human-readable USD strings, e.g. "0.10". */
  baseFeeAmountUsd: string;
  builderFeeAmountUsd: string;
  totalFeeAmountUsd: string;
  builderName: string | null;
  uiFeeReceiver: string;
}

/** POST /orders/prepare */
export interface PrepareOrderResponse {
  orderId: string;
  expiresAt: string;
  eip712Payload: Eip712Payload;
  feeBreakdown: OrderFeeBreakdown;
}

/** POST /orders/submit body */
export interface SubmitOrderPayload {
  orderId: string;
  signature: string;
}

/** POST /orders/submit (202) */
export interface SubmitOrderResponse {
  orderId: string;
  txHash: string;
  status: string;
  submittedAt: string;
}

/** Spec error codes this interface handles explicitly. */
export const ERROR_CODES = {
  NOT_A_BUILDER: "NOT_A_BUILDER",
  BUILDER_NOT_FOUND: "BUILDER_NOT_FOUND",
  BUILDER_FROZEN: "BUILDER_FROZEN",
  UNKNOWN_BUILDER: "UNKNOWN_BUILDER",
  FORBIDDEN: "FORBIDDEN",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INVALID_FEE_RATE: "INVALID_FEE_RATE",
  INVALID_MARKET: "INVALID_MARKET",
  INVALID_ORDER_TYPE: "INVALID_ORDER_TYPE",
  INVALID_SIZE: "INVALID_SIZE",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  ORDER_ALREADY_SUBMITTED: "ORDER_ALREADY_SUBMITTED",
  ORDER_EXPIRED: "ORDER_EXPIRED",
  SIGNATURE_MISMATCH: "SIGNATURE_MISMATCH",
} as const;
