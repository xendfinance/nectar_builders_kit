import type { StatsPeriod } from "@/api/types";
import { Card } from "@/components/Card";
import { ErrorState, LoadingState } from "@/components/states";
import { useBuilderStats } from "@/hooks/queries";
import { formatNumber, formatUsd } from "@/lib/format";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface-base p-3">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </div>
  );
}

export function StatsGrid({ period }: { period: StatsPeriod }) {
  const stats = useBuilderStats(period);
  const data = stats.data?.stats;

  return (
    <Card title="Performance" endpoints={["builder.stats"]} source="builderStats">
      {stats.error && <ErrorState error={stats.error} />}
      {!stats.error && !stats.data && <LoadingState />}
      {stats.data && !data && <p className="text-sm text-ink-faint">No stats for this period.</p>}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat
            label="Builder fees earned"
            value={formatUsd(data.builderFeeEarnedUsd)}
            hint="Paid to your fee receiver"
          />
          <Stat label="Volume" value={formatUsd(data.volumeUsd, { compact: true })} />
          <Stat label="Trades" value={formatNumber(data.tradeCount)} />
          <Stat label="Unique users" value={formatNumber(data.uniqueUsers)} />
          <Stat
            label="Base fees passed through"
            value={formatUsd(data.baseFeePassThroughUsd)}
            hint="Protocol fee on your users' trades"
          />
          <Stat
            label="Attributed / direct trades"
            value={`${formatNumber(data.builderAttributedTrades)} / ${formatNumber(data.directTrades)}`}
            hint="Direct: same users trading without you"
          />
        </div>
      )}
    </Card>
  );
}
