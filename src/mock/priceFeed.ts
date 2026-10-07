import type { CandlePeriod, RawCandle } from "@/api/types";

import { HISTORY_DAYS, MARKET_SIMULATION } from "./fixtures";
import type { MarketSimulation } from "./fixtures";
import { createRandom, gaussian, hashString, unitHash } from "./random";
import type { Random } from "./random";

/**
 * Simulated oracle prices. Each symbol gets one minute-resolution random walk, anchored so the latest close equals
 * the reference price at startup, and extended forward as time passes. Tickers, candles, the order book and recent
 * trades all read the same path, so every view agrees on the price at any instant.
 */

const MINUTE_MS = 60_000;
const MINUTES_PER_YEAR = 525_600;
/** Pull toward the reference level (in log space) with a ~30-day half-life, so 90 days of history stay plausible. */
const MEAN_REVERSION = 1 / (30 * 1440);
/** Max intra-minute deviation from the straight open→close line, as a multiple of per-minute volatility. */
const JITTER = 0.6;

export const PERIOD_MINUTES: Record<CandlePeriod, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
};

interface Ohlc {
  open: number;
  high: number;
  low: number;
  close: number;
}

class PriceSeries {
  private readonly closes: number[];
  private readonly originMinute: number;
  private readonly random: Random;
  private readonly sigma: number;
  private readonly bucketCache = new Map<string, Ohlc>();

  constructor(
    private readonly symbol: string,
    simulation: MarketSimulation,
    nowMs: number,
    seed: number
  ) {
    this.sigma = simulation.annualVolatility / Math.sqrt(MINUTES_PER_YEAR);
    this.random = createRandom(seed ^ hashString(symbol));

    const count = HISTORY_DAYS * 1440 + 1;
    const currentMinute = Math.floor(nowMs / MINUTE_MS);
    this.originMinute = currentMinute - (count - 1);

    const logs = new Float64Array(count);
    for (let index = 1; index < count; index++) {
      logs[index] = (logs[index - 1] ?? 0) * (1 - MEAN_REVERSION) + this.sigma * gaussian(this.random);
    }
    const last = logs[count - 1] ?? 0;
    this.closes = Array.from(logs, (value) => simulation.referencePrice * Math.exp(value - last));
  }

  /** Earliest minute with a defined open (the close of the minute before). */
  get firstMinute() {
    return this.originMinute + 1;
  }

  private close(minute: number): number {
    while (this.originMinute + this.closes.length - 1 < minute) {
      const previous = this.closes[this.closes.length - 1] as number;
      this.closes.push(previous * Math.exp(this.sigma * gaussian(this.random)));
    }
    return this.closes[Math.max(0, minute - this.originMinute)] as number;
  }

  /** Price at any instant: linear from the minute's open to its close, plus a bounded deterministic wobble. */
  priceAt(timeMs: number): number {
    const minute = Math.floor(timeMs / MINUTE_MS);
    const open = this.close(minute - 1);
    const close = this.close(minute);
    const fraction = (timeMs - minute * MINUTE_MS) / MINUTE_MS;
    const noise = unitHash(`${this.symbol}:jitter:${Math.floor(timeMs / 1000)}`) * 2 - 1;
    return open + (close - open) * fraction + open * this.sigma * JITTER * Math.sin(Math.PI * fraction) * noise;
  }

  private minuteCandle(minute: number, nowMs: number): Ohlc {
    const open = this.close(minute - 1);
    const isComplete = (minute + 1) * MINUTE_MS <= nowMs;

    if (!isComplete) {
      const live = this.priceAt(nowMs);
      return { open, high: Math.max(open, live), low: Math.min(open, live), close: live };
    }

    const close = this.close(minute);
    // Wicks always cover the intra-minute wobble, so no price ever printed falls outside its candle.
    const reach = open * this.sigma;
    return {
      open,
      close,
      high: Math.max(open, close) + reach * (JITTER + 0.4 * unitHash(`${this.symbol}:high:${minute}`)),
      low: Math.min(open, close) - reach * (JITTER + 0.4 * unitHash(`${this.symbol}:low:${minute}`)),
    };
  }

  private aggregate(fromMinute: number, toMinute: number, nowMs: number): Ohlc {
    let result: Ohlc | undefined;
    for (let minute = fromMinute; minute <= toMinute; minute++) {
      const candle = this.minuteCandle(minute, nowMs);
      result =
        result === undefined
          ? { ...candle }
          : {
              open: result.open,
              high: Math.max(result.high, candle.high),
              low: Math.min(result.low, candle.low),
              close: candle.close,
            };
    }
    if (result === undefined) {
      throw new Error("aggregate() needs at least one minute");
    }
    return result;
  }

  candles(period: CandlePeriod, limit: number, nowMs: number): RawCandle[] {
    const size = PERIOD_MINUTES[period];
    const currentMinute = Math.floor(nowMs / MINUTE_MS);
    const lastBucket = Math.floor(currentMinute / size) * size;
    const candles: RawCandle[] = [];

    for (let index = limit - 1; index >= 0; index--) {
      const bucket = lastBucket - index * size;
      const fromMinute = Math.max(bucket, this.firstMinute);
      const toMinute = Math.min(bucket + size - 1, currentMinute);
      if (fromMinute > toMinute) {
        continue;
      }

      const isComplete = toMinute < currentMinute;
      const cacheKey = `${size}:${bucket}`;
      let ohlc = isComplete ? this.bucketCache.get(cacheKey) : undefined;
      if (ohlc === undefined) {
        ohlc = this.aggregate(fromMinute, toMinute, nowMs);
        if (isComplete) {
          this.bucketCache.set(cacheKey, ohlc);
        }
      }
      candles.push([bucket * 60, ohlc.open, ohlc.high, ohlc.low, ohlc.close]);
    }
    return candles;
  }

  dayStats(nowMs: number): Ohlc {
    const currentMinute = Math.floor(nowMs / MINUTE_MS);
    // Start at the minute containing `now - 24h`, so the open below always lies inside [low, high].
    const day = this.aggregate(currentMinute - 1440, currentMinute, nowMs);
    return { ...day, open: this.priceAt(nowMs - 24 * 60 * MINUTE_MS), close: this.priceAt(nowMs) };
  }
}

export class PriceFeed {
  private readonly series = new Map<string, PriceSeries>();

  constructor(nowMs: number, seed: number) {
    for (const [symbol, simulation] of Object.entries(MARKET_SIMULATION)) {
      this.series.set(symbol, new PriceSeries(symbol, simulation, nowMs, seed));
    }
  }

  has(symbol: string): boolean {
    return this.series.has(symbol);
  }

  private get(symbol: string): PriceSeries {
    const series = this.series.get(symbol);
    if (!series) {
      throw new Error(`No simulated price for ${symbol}`);
    }
    return series;
  }

  priceAt(symbol: string, timeMs: number): number {
    return this.get(symbol).priceAt(timeMs);
  }

  candles(symbol: string, period: CandlePeriod, limit: number, nowMs: number): RawCandle[] {
    return this.get(symbol).candles(period, limit, nowMs);
  }

  dayStats(symbol: string, nowMs: number): Ohlc {
    return this.get(symbol).dayStats(nowMs);
  }
}
