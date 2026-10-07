import type { DayCandleItem, TickerItem } from "@/api/types";

import { scaledToNumber } from "./units";

/** Mark price: midpoint of the oracle's min and max price. */
export function tickerMid(ticker: TickerItem): number {
  const min = scaledToNumber(ticker.minPrice, ticker.oracleDecimals);
  const max = scaledToNumber(ticker.maxPrice, ticker.oracleDecimals);
  return (min + max) / 2;
}

export function findTicker(tickers: TickerItem[] | undefined, symbol: string): TickerItem | undefined {
  return tickers?.find((ticker) => ticker.tokenSymbol === symbol);
}

export function findDayStats(stats: DayCandleItem[] | undefined, symbol: string): DayCandleItem | undefined {
  return stats?.find((item) => item.tokenSymbol === symbol);
}

/** 24h change in percent, from the 24h open to the current price. */
export function dayChangePercent(day: DayCandleItem | undefined, price: number | undefined): number | undefined {
  if (!day || price === undefined || day.open === 0) {
    return undefined;
  }
  return ((price - day.open) / day.open) * 100;
}
