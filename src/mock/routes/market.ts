import type {
  CandlePeriod,
  DayCandleItem,
  OrderbookLevel,
  OrderbookResponse,
  RecentTradeItem,
  TickerItem,
} from "@/api/types";
import { findMarketBySymbol, MARKETS, USDC, USDT } from "@/lib/markets";
import type { MarketConfig, TokenConfig } from "@/lib/markets";
import { numberToScaled } from "@/lib/units";

import { HttpError, MOCK_ERROR_CODES, ok, readEnum, readOptionalInt } from "../http";
import type { RouteContext } from "../http";
import { PERIOD_MINUTES } from "../priceFeed";
import { unitHash } from "../random";
import type { Route } from "../router";

const ORACLE_DECIMALS = 30;
/** Half-spread between minPrice and maxPrice. */
const HALF_SPREAD = 0.0001;
const STABLES: TokenConfig[] = [USDC, USDT];
const CANDLE_PERIODS = Object.keys(PERIOD_MINUTES) as CandlePeriod[];
/** Recent trades are drawn on a fixed 4s grid so consecutive polls return the same history. */
const TRADE_SLOT_MS = 4_000;
/** The order book reshuffles its sizes every 5s. */
const BOOK_REFRESH_MS = 5_000;

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function requestedSymbols(query: Record<string, string>): Set<string> | undefined {
  const raw = query.symbols;
  return raw === undefined ? undefined : new Set(raw.split(",").map((symbol) => symbol.trim()));
}

function requireMarket(symbol: string | undefined, name: string): MarketConfig {
  const market = symbol === undefined ? undefined : findMarketBySymbol(symbol);
  if (!market) {
    const known = MARKETS.map((candidate) => candidate.indexToken.symbol).join(", ");
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, `"${name}" must be one of: ${known}`);
  }
  return market;
}

function tickers({ db, request, now }: RouteContext) {
  const wanted = requestedSymbols(request.query);
  const updatedAt = Math.floor(now / 1000);
  const items: TickerItem[] = [];

  const push = (token: TokenConfig, price: number) => {
    if (wanted && !wanted.has(token.symbol)) {
      return;
    }
    items.push({
      minPrice: numberToScaled(price * (1 - HALF_SPREAD), ORACLE_DECIMALS).toString(),
      maxPrice: numberToScaled(price * (1 + HALF_SPREAD), ORACLE_DECIMALS).toString(),
      oracleDecimals: ORACLE_DECIMALS,
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      updatedAt,
    });
  };

  for (const market of MARKETS) {
    push(market.indexToken, db.feed.priceAt(market.indexToken.symbol, now));
  }
  for (const stable of STABLES) {
    push(stable, 1);
  }
  return ok(items);
}

function dayStats({ db, request, now }: RouteContext) {
  const wanted = requestedSymbols(request.query);
  const items: DayCandleItem[] = [];

  for (const market of MARKETS) {
    const { symbol } = market.indexToken;
    if (wanted && !wanted.has(symbol)) {
      continue;
    }
    const day = db.feed.dayStats(symbol, now);
    const decimals = market.priceDecimals + 2;
    items.push({
      tokenSymbol: symbol,
      open: round(day.open, decimals),
      high: round(day.high, decimals),
      low: round(day.low, decimals),
      close: round(day.close, decimals),
    });
  }
  for (const stable of STABLES) {
    if (!wanted || wanted.has(stable.symbol)) {
      items.push({ tokenSymbol: stable.symbol, open: 1, high: 1, low: 1, close: 1 });
    }
  }
  return ok(items);
}

function candles({ db, request, now }: RouteContext) {
  const market = requireMarket(request.query.tokenSymbol, "tokenSymbol");
  const period = readEnum(request.query, "period", CANDLE_PERIODS);
  if (period === undefined) {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, `"period" is required: ${CANDLE_PERIODS.join(", ")}`);
  }
  const limit = readOptionalInt(request.query, "limit", { min: 1, max: 1000 }) ?? 200;
  const decimals = market.priceDecimals + 2;

  // Rounding is monotonic, so high ≥ open/close ≥ low still holds after it.
  const rows = db.feed
    .candles(market.indexToken.symbol, period, limit, now)
    .map(
      ([time, open, high, low, close]) =>
        [time, round(open, decimals), round(high, decimals), round(low, decimals), round(close, decimals)] as const
    );
  return ok({ candles: rows });
}

function orderbook({ db, request, params, now }: RouteContext) {
  const market = requireMarket(params.symbol, "symbol");
  const limit = readOptionalInt(request.query, "limit", { min: 1, max: 50 }) ?? 15;
  const { symbol } = market.indexToken;
  const mid = db.feed.priceAt(symbol, now);
  const tick = mid * 0.0002;
  const refresh = Math.floor(now / BOOK_REFRESH_MS);

  const side = (direction: 1 | -1): OrderbookLevel[] => {
    let total = 0;
    return Array.from({ length: limit }, (_, index) => {
      const price = mid + direction * tick * (index + 0.5);
      const notionalUsd =
        1_500 + unitHash(`${symbol}:book:${refresh}:${direction}:${index}`) * 30_000 * (1 + index * 0.15);
      const size = notionalUsd / price;
      total += size;
      return {
        price: price.toFixed(market.priceDecimals),
        sizeInToken: size.toFixed(market.sizeDecimals),
        totalInToken: total.toFixed(market.sizeDecimals),
      };
    });
  };

  const response: OrderbookResponse = { bids: side(-1), asks: side(1) };
  return ok(response);
}

function recentTrades({ db, request, params, now }: RouteContext) {
  const market = requireMarket(params.symbol, "symbol");
  const limit = readOptionalInt(request.query, "limit", { min: 1, max: 100 }) ?? 30;
  const { symbol } = market.indexToken;
  const items: RecentTradeItem[] = [];

  for (let slot = Math.floor(now / TRADE_SLOT_MS); items.length < limit && slot > 0; slot--) {
    if (unitHash(`${symbol}:trade:${slot}`) > 0.7) {
      continue;
    }
    const timeMs = slot * TRADE_SLOT_MS + Math.floor(unitHash(`${symbol}:offset:${slot}`) * TRADE_SLOT_MS);
    if (timeMs > now) {
      continue;
    }
    const price = db.feed.priceAt(symbol, timeMs);
    const notionalUsd = 200 + Math.pow(unitHash(`${symbol}:size:${slot}`), 3) * 40_000;
    items.push({
      id: slot,
      price: price.toFixed(market.priceDecimals),
      sizeInToken: (notionalUsd / price).toFixed(market.sizeDecimals),
      createdAt: new Date(timeMs).toISOString(),
    });
  }
  return ok(items);
}

export const marketRoutes: Route[] = [
  { method: "GET", path: "/oracle-keeper/prices/tickers", handler: tickers },
  { method: "GET", path: "/oracle-keeper/prices/24h", handler: dayStats },
  { method: "GET", path: "/oracle-keeper/prices/candles", handler: candles },
  { method: "GET", path: "/orderbooks/:symbol", handler: orderbook },
  { method: "GET", path: "/trades/:symbol", handler: recentTrades },
];
