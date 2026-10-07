import type { BuilderTradeItem, StatsPeriod } from "@/api/types";

/**
 * The spec has no time-series endpoint, so the fees chart pages through /builders/me/trades and buckets the trades
 * here. Buckets end at `nowMs` and the first one starts where the stats window starts, so the buckets of a period
 * add up to the matching /builders/me/stats numbers.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export type SeriesInterval = "hour" | "day" | "week";

export interface SeriesWindow {
  interval: SeriesInterval;
  sizeMs: number;
  count: number;
  startMs: number;
}

export interface FeeSeriesPoint {
  /** Bucket start, ms. */
  start: number;
  tradeCount: number;
  volumeUsd: number;
  builderFeeUsd: number;
  baseFeeUsd: number;
}

const FIXED_WINDOWS: Record<
  Exclude<StatsPeriod, "all">,
  { interval: SeriesInterval; sizeMs: number; count: number }
> = {
  "24h": { interval: "hour", sizeMs: HOUR_MS, count: 24 },
  "7d": { interval: "day", sizeMs: DAY_MS, count: 7 },
  "30d": { interval: "day", sizeMs: DAY_MS, count: 30 },
};

export function getSeriesWindow(period: StatsPeriod, nowMs: number, registeredAtMs: number): SeriesWindow {
  const fixed =
    period === "all"
      ? {
          interval: "week" as const,
          sizeMs: WEEK_MS,
          count: Math.max(1, Math.ceil((nowMs - registeredAtMs) / WEEK_MS)),
        }
      : FIXED_WINDOWS[period];
  return { ...fixed, startMs: nowMs - fixed.count * fixed.sizeMs };
}

/** Lower bound to request from /builders/me/trades, in unix seconds. Undefined for "all". */
export function getFromTimestamp(period: StatsPeriod, window: SeriesWindow): number | undefined {
  return period === "all" ? undefined : Math.ceil(window.startMs / 1000);
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

export function bucketTrades(trades: BuilderTradeItem[], window: SeriesWindow): FeeSeriesPoint[] {
  const points: FeeSeriesPoint[] = Array.from({ length: window.count }, (_, index) => ({
    start: window.startMs + index * window.sizeMs,
    tradeCount: 0,
    volumeUsd: 0,
    builderFeeUsd: 0,
    baseFeeUsd: 0,
  }));

  for (const trade of trades) {
    const offset = Date.parse(trade.settledAt) - window.startMs;
    if (offset < 0) {
      continue;
    }
    // A trade settled exactly at `now` belongs to the last bucket.
    const point = points[Math.min(Math.floor(offset / window.sizeMs), window.count - 1)];
    if (point === undefined) {
      continue;
    }
    point.tradeCount += 1;
    point.volumeUsd += trade.sizeDeltaUsd;
    point.builderFeeUsd += trade.builderFeeUsd;
    point.baseFeeUsd += trade.baseFeeUsd;
  }

  return points.map((point) => ({
    ...point,
    volumeUsd: roundCents(point.volumeUsd),
    builderFeeUsd: roundCents(point.builderFeeUsd),
    baseFeeUsd: roundCents(point.baseFeeUsd),
  }));
}
