import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/endpoints";
import type {
  BuilderTradeItem,
  BuilderUsersParams,
  CandlePeriod,
  PrepareOrderPayload,
  StatsPeriod,
  SubmitOrderPayload,
  UpdateBuilderPayload,
} from "@/api/types";
import { POLL_MS } from "@/config";
import { useWallet } from "@/context/WalletContext";
import { useInspector } from "@/inspector/store";
import { INDEX_SYMBOLS } from "@/lib/markets";

/**
 * React Query hooks: one per screen need, each calling one typed endpoint with the UI source that uses it.
 * Keys of session-scoped data start with "authed" and include the access token, so signing out (or in as another
 * wallet) can never show the previous session's data.
 */

/** Poll interval, or false while polling is paused from the API Inspector. */
function usePollInterval(ms: number): number | false {
  const isPolling = useInspector((state) => state.isPolling);
  return isPolling ? ms : false;
}

// ─── Market data ─────────────────────────────────────────────────────────────

export function useTickers() {
  return useQuery({
    queryKey: ["tickers"],
    queryFn: () => api.market.tickers(INDEX_SYMBOLS, "tradeMarketHeader"),
    refetchInterval: usePollInterval(POLL_MS.tickers),
  });
}

export function useDayStats() {
  return useQuery({
    queryKey: ["dayStats"],
    queryFn: () => api.market.dayStats(INDEX_SYMBOLS, "tradeMarketHeader"),
    refetchInterval: usePollInterval(60_000),
  });
}

export function useCandles(tokenSymbol: string, period: CandlePeriod, limit: number) {
  return useQuery({
    queryKey: ["candles", tokenSymbol, period, limit],
    queryFn: () => api.market.candles({ tokenSymbol, period, limit }, "tradeChart"),
    refetchInterval: usePollInterval(POLL_MS.candles),
  });
}

export function useOrderbook(symbol: string, limit: number) {
  return useQuery({
    queryKey: ["orderbook", symbol, limit],
    queryFn: () => api.market.orderbook(symbol, limit, "tradeOrderbook"),
    refetchInterval: usePollInterval(POLL_MS.orderbook),
    placeholderData: keepPreviousData,
  });
}

export function useRecentTrades(symbol: string, limit: number) {
  return useQuery({
    queryKey: ["recentTrades", symbol, limit],
    queryFn: () => api.market.trades(symbol, limit, "tradeRecentTrades"),
    refetchInterval: usePollInterval(POLL_MS.trades),
  });
}

export function useAccountOrders(account: string | undefined) {
  return useQuery({
    queryKey: ["accountOrders", account],
    queryFn: () => api.account.orders(account ?? "", "tradeOrders"),
    enabled: account !== undefined,
    refetchInterval: usePollInterval(POLL_MS.orders),
  });
}

// ─── Session ─────────────────────────────────────────────────────────────────

function useToken() {
  return useWallet().session?.accessToken;
}

export function useAuthSession() {
  const token = useToken();
  return useQuery({
    queryKey: ["authed", token, "session"],
    queryFn: () => api.auth.session("tradeOrderForm"),
    enabled: token !== undefined,
  });
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function usePrepareOrder() {
  return useMutation({ mutationFn: (payload: PrepareOrderPayload) => api.orders.prepare(payload, "tradeOrderForm") });
}

export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitOrderPayload) => api.orders.submit(payload, "tradeOrderForm"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accountOrders"] }),
  });
}

// ─── Builder dashboard ───────────────────────────────────────────────────────

export function useBuilderMe() {
  const token = useToken();
  return useQuery({
    queryKey: ["authed", token, "builder", "me"],
    queryFn: () => api.builder.me("builderProfile"),
    enabled: token !== undefined,
  });
}

export function useBuilderStats(period: StatsPeriod) {
  const token = useToken();
  return useQuery({
    queryKey: ["authed", token, "builder", "stats", period],
    queryFn: () => api.builder.stats({ period }, "builderStats"),
    enabled: token !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useBuilderUsers(params: BuilderUsersParams, enabled: boolean) {
  const token = useToken();
  return useQuery({
    queryKey: ["authed", token, "builder", "users", params],
    queryFn: () => api.builder.users(params, "builderUsers"),
    enabled: token !== undefined && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useBuilderTrades(page: number, pageSize: number, enabled: boolean) {
  const token = useToken();
  return useQuery({
    queryKey: ["authed", token, "builder", "trades", page, pageSize],
    queryFn: () => api.builder.trades({ page, pageSize }, "builderTrades"),
    enabled: token !== undefined && enabled,
    placeholderData: keepPreviousData,
  });
}

/** Upper bound on pages fetched for the chart, so a very active builder can't trigger unbounded requests. */
const MAX_SERIES_PAGES = 20;
const SERIES_PAGE_SIZE = 100;

/** Every trade since `fromTimestamp`, fetched page by page. Feeds the fees chart (see `lib/feeSeries.ts`). */
export function useBuilderTradesSince(fromTimestamp: number | undefined, enabled: boolean) {
  const token = useToken();
  return useQuery({
    queryKey: ["authed", token, "builder", "tradesSince", fromTimestamp],
    queryFn: async () => {
      const trades: BuilderTradeItem[] = [];
      for (let page = 1; page <= MAX_SERIES_PAGES; page++) {
        const result = await api.builder.trades(
          { fromTimestamp, page, pageSize: SERIES_PAGE_SIZE },
          "builderFeesChart"
        );
        trades.push(...result.items);
        if (result.items.length < SERIES_PAGE_SIZE || trades.length >= result.totalItems) {
          return { trades, isTruncated: false };
        }
      }
      return { trades, isTruncated: true };
    },
    enabled: token !== undefined && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useUpdateBuilder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ builderId, payload }: { builderId: string; payload: UpdateBuilderPayload }) =>
      api.builder.update(builderId, payload, "builderSettings"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authed"] }),
  });
}
