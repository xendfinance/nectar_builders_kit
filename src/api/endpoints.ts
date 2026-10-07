import type { UiSource } from "./catalog";
import { callEndpoint } from "./client";
import type {
  AccountOrderItem,
  AuthSessionResponse,
  BuilderProfileResponse,
  BuilderStatsParams,
  BuilderStatsResponse,
  BuilderTradesParams,
  BuilderTradesResponse,
  BuilderUsersParams,
  BuilderUsersResponse,
  CandlesParams,
  CandlesResponse,
  DayCandleItem,
  NonceParams,
  NonceResponse,
  OrderbookResponse,
  PrepareOrderPayload,
  PrepareOrderResponse,
  RecentTradeItem,
  SubmitOrderPayload,
  SubmitOrderResponse,
  TickerItem,
  UpdateBuilderPayload,
  UpdateBuilderResponse,
  VerifyPayload,
  VerifyResponse,
} from "./types";

/**
 * Typed function per endpoint. This is the file to copy into your own app: each function is one HTTP call, named
 * after what it returns, and takes the `source` so the API Inspector can attribute it to a UI panel.
 */
export const api = {
  auth: {
    nonce: (params: NonceParams, source: UiSource) =>
      callEndpoint<NonceResponse>("auth.nonce", { source, query: params }),
    verify: (payload: VerifyPayload, source: UiSource) =>
      callEndpoint<VerifyResponse>("auth.verify", { source, body: payload }),
    session: (source: UiSource) => callEndpoint<AuthSessionResponse>("auth.session", { source }),
  },

  market: {
    tickers: (symbols: string[], source: UiSource) =>
      callEndpoint<TickerItem[]>("oracle.tickers", { source, query: { symbols: symbols.join(",") } }),
    dayStats: (symbols: string[], source: UiSource) =>
      callEndpoint<DayCandleItem[]>("oracle.24h", { source, query: { symbols: symbols.join(",") } }),
    candles: (params: CandlesParams, source: UiSource) =>
      callEndpoint<CandlesResponse>("oracle.candles", { source, query: params }),
    orderbook: (symbol: string, limit: number, source: UiSource) =>
      callEndpoint<OrderbookResponse>("market.orderbook", { source, path: { symbol }, query: { limit } }),
    trades: (symbol: string, limit: number, source: UiSource) =>
      callEndpoint<RecentTradeItem[]>("market.trades", { source, path: { symbol }, query: { limit } }),
  },

  account: {
    orders: (account: string, source: UiSource) =>
      callEndpoint<AccountOrderItem[]>("account.orders", { source, path: { account } }),
  },

  orders: {
    prepare: (payload: PrepareOrderPayload, source: UiSource) =>
      callEndpoint<PrepareOrderResponse>("orders.prepare", { source, body: payload }),
    submit: (payload: SubmitOrderPayload, source: UiSource) =>
      callEndpoint<SubmitOrderResponse>("orders.submit", { source, body: payload }),
  },

  builder: {
    me: (source: UiSource) => callEndpoint<BuilderProfileResponse>("builder.me", { source }),
    stats: (params: BuilderStatsParams, source: UiSource) =>
      callEndpoint<BuilderStatsResponse>("builder.stats", { source, query: params }),
    users: (params: BuilderUsersParams, source: UiSource) =>
      callEndpoint<BuilderUsersResponse>("builder.users", { source, query: params }),
    trades: (params: BuilderTradesParams, source: UiSource) =>
      callEndpoint<BuilderTradesResponse>("builder.trades", { source, query: params }),
    update: (builderId: string, payload: UpdateBuilderPayload, source: UiSource) =>
      callEndpoint<UpdateBuilderResponse>("builder.update", { source, path: { builderId }, body: payload }),
  },
};
