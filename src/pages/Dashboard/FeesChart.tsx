import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";

import type { StatsPeriod } from "@/api/types";
import { Card } from "@/components/Card";
import { EmptyState, ErrorState, LoadingState, Spinner } from "@/components/states";
import { useBuilderTradesSince } from "@/hooks/queries";
import { CHART_COLORS } from "@/lib/chartTheme";
import { bucketTrades, getFromTimestamp, getSeriesWindow } from "@/lib/feeSeries";
import type { FeeSeriesPoint, SeriesInterval } from "@/lib/feeSeries";
import { formatNumber, formatUsd } from "@/lib/format";

const SERIES_LABELS = { builderFeeUsd: "Builder fee (yours)", baseFeeUsd: "Base fee (protocol)" } as const;

function formatBucket(start: number, interval: SeriesInterval) {
  const date = new Date(start);
  if (interval === "hour") {
    return date.toLocaleTimeString("en-US", { hour: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, interval }: TooltipProps<number, string> & { interval: SeriesInterval }) {
  const point = payload?.[0]?.payload as FeeSeriesPoint | undefined;
  if (!active || !point) {
    return null;
  }
  return (
    <div className="rounded-md border border-surface-line bg-surface-raised p-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">
        {interval === "week" ? "Week of " : ""}
        {new Date(point.start).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          ...(interval === "hour" ? { hour: "numeric" } : {}),
        })}
      </p>
      <p style={{ color: CHART_COLORS.builderFees }}>
        {SERIES_LABELS.builderFeeUsd}: {formatUsd(point.builderFeeUsd)}
      </p>
      <p style={{ color: CHART_COLORS.baseFees }}>
        {SERIES_LABELS.baseFeeUsd}: {formatUsd(point.baseFeeUsd)}
      </p>
      <p className="text-ink-muted">
        {formatNumber(point.tradeCount)} trades · {formatUsd(point.volumeUsd, { compact: true })} volume
      </p>
    </div>
  );
}

/**
 * Fees over time. The spec has no time-series endpoint, so this pages through /builders/me/trades for the period
 * and buckets the trades client-side (src/lib/feeSeries.ts).
 */
export function FeesChart({ period, registeredAt }: { period: StatsPeriod; registeredAt: string }) {
  // Fixed per period selection: a window derived from Date.now() on every render would change the query key.
  const seriesWindow = useMemo(
    () => getSeriesWindow(period, Date.now(), Date.parse(registeredAt)),
    [period, registeredAt]
  );
  const query = useBuilderTradesSince(getFromTimestamp(period, seriesWindow), true);
  const points = useMemo(
    () => (query.data ? bucketTrades(query.data.trades, seriesWindow) : []),
    [query.data, seriesWindow]
  );
  const hasFees = points.some((point) => point.tradeCount > 0);

  return (
    <Card
      title="Fees over time"
      endpoints={["builder.trades"]}
      source="builderFeesChart"
      actions={query.isFetching ? <Spinner className="h-3 w-3" /> : undefined}
    >
      {query.error && <ErrorState error={query.error} />}
      {!query.error && !query.data && <LoadingState />}
      {query.data && !hasFees && <EmptyState>No attributed trades in this period.</EmptyState>}
      {query.data && hasFees && (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis
                dataKey="start"
                tickFormatter={(value: number) => formatBucket(value, seriesWindow.interval)}
                tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                axisLine={{ stroke: CHART_COLORS.axis }}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(value: number) => formatUsd(value, { compact: true })}
                tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip
                content={<ChartTooltip interval={seriesWindow.interval} />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Legend
                formatter={(value: keyof typeof SERIES_LABELS) => (
                  <span className="text-xs text-ink-muted">{SERIES_LABELS[value]}</span>
                )}
              />
              <Bar dataKey="builderFeeUsd" stackId="fees" fill={CHART_COLORS.builderFees} maxBarSize={28} />
              <Bar
                dataKey="baseFeeUsd"
                stackId="fees"
                fill={CHART_COLORS.baseFees}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {query.data?.isTruncated && (
        <p className="mt-2 text-xs text-warn">Showing the most recent trades only: the page limit was reached.</p>
      )}
      <p className="mt-2 text-[11px] text-ink-faint">
        {seriesWindow.interval === "hour" ? "Hourly" : seriesWindow.interval === "day" ? "Daily" : "Weekly"} buckets,
        local time.
      </p>
    </Card>
  );
}
