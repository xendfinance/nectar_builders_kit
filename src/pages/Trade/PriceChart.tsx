import { CandlestickSeries, ColorType, createChart, CrosshairMode } from "lightweight-charts";
import type { CandlestickData, IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import type { CandlePeriod } from "@/api/types";
import { Card } from "@/components/Card";
import { Segmented } from "@/components/Segmented";
import { ErrorState, Spinner } from "@/components/states";
import { useCandles } from "@/hooks/queries";
import { CHART_COLORS } from "@/lib/chartTheme";
import type { MarketConfig } from "@/lib/markets";

const PERIODS: { value: CandlePeriod; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1D" },
];

const CANDLE_LIMIT = 300;

/** Candlestick chart on TradingView's open-source lightweight-charts, fed by /oracle-keeper/prices/candles. */
export function PriceChart({ market }: { market: MarketConfig }) {
  const [period, setPeriod] = useState<CandlePeriod>("15m");
  const candles = useCandles(market.indexToken.symbol, period, CANDLE_LIMIT);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi>();
  const seriesRef = useRef<ISeriesApi<"Candlestick">>();
  /** The symbol/period the series currently holds, and its newest bar time. */
  const loadedRef = useRef<{ key: string; lastTime: number }>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.surface },
        textColor: CHART_COLORS.tick,
        fontSize: 11,
        attributionLogo: true,
      },
      grid: { vertLines: { color: CHART_COLORS.grid }, horzLines: { color: CHART_COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART_COLORS.axis },
      timeScale: { borderColor: CHART_COLORS.axis, timeVisible: true, secondsVisible: false },
    });
    seriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
      borderVisible: false,
    });
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = undefined;
      seriesRef.current = undefined;
      loadedRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    seriesRef.current?.applyOptions({
      priceFormat: { type: "price", precision: market.priceDecimals, minMove: 10 ** -market.priceDecimals },
    });
  }, [market.priceDecimals]);

  useEffect(() => {
    const series = seriesRef.current;
    const data = candles.data;
    if (!series || !data || data.candles.length === 0) {
      return;
    }

    const bars: CandlestickData<UTCTimestamp>[] = data.candles.map(([time, open, high, low, close]) => ({
      time: time as UTCTimestamp,
      open,
      high,
      low,
      close,
    }));
    const key = `${market.indexToken.symbol}:${period}`;
    const lastTime = bars[bars.length - 1]!.time;

    if (loadedRef.current?.key === key) {
      // Poll refresh: update the forming bar and append new ones without resetting the user's zoom or scroll.
      const fromTime = loadedRef.current.lastTime;
      bars.filter((bar) => bar.time >= fromTime).forEach((bar) => series.update(bar));
    } else {
      series.setData(bars);
      chartRef.current?.timeScale().scrollToRealTime();
    }
    loadedRef.current = { key, lastTime };
  }, [candles.data, market.indexToken.symbol, period]);

  return (
    <Card
      title={`${market.name} price`}
      endpoints={["oracle.candles"]}
      source="tradeChart"
      bodyClassName="relative p-0"
      actions={
        <div className="flex items-center gap-2">
          {candles.isFetching && <Spinner className="h-3 w-3" />}
          <Segmented ariaLabel="Candle period" value={period} onChange={setPeriod} options={PERIODS} />
        </div>
      }
    >
      <div ref={containerRef} className="h-[420px] w-full" />
      {candles.error && (
        <div className="absolute inset-4">
          <ErrorState error={candles.error} />
        </div>
      )}
      <p className="px-4 py-2 text-[11px] text-ink-faint">Times in UTC. Candles refresh every 15s.</p>
    </Card>
  );
}
