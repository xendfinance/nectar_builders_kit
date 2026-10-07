import clsx from "clsx";

import { ApiBadge } from "@/components/ApiBadge";
import { useDayStats, useTickers } from "@/hooks/queries";
import { formatPercent, formatPrice } from "@/lib/format";
import { MARKETS } from "@/lib/markets";
import type { MarketConfig } from "@/lib/markets";
import { dayChangePercent, findDayStats, findTicker, tickerMid } from "@/lib/prices";

interface MarketHeaderProps {
  market: MarketConfig;
  onSelect: (market: MarketConfig) => void;
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <span className={clsx("text-sm tabular-nums", className ?? "text-ink")}>{value}</span>
    </div>
  );
}

export function MarketHeader({ market, onSelect }: MarketHeaderProps) {
  const tickers = useTickers();
  const dayStats = useDayStats();

  const ticker = findTicker(tickers.data, market.indexToken.symbol);
  const price = ticker ? tickerMid(ticker) : undefined;
  const day = findDayStats(dayStats.data, market.indexToken.symbol);
  const change = dayChangePercent(day, price);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-surface-line bg-surface-card p-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="tablist" aria-label="Market" className="flex gap-1">
          {MARKETS.map((candidate) => {
            const candidateTicker = findTicker(tickers.data, candidate.indexToken.symbol);
            return (
              <button
                key={candidate.marketKey}
                type="button"
                role="tab"
                aria-selected={candidate.marketKey === market.marketKey}
                onClick={() => onSelect(candidate)}
                className={clsx(
                  "flex flex-col rounded-md px-3 py-1.5 text-left",
                  candidate.marketKey === market.marketKey ? "bg-surface-raised" : "hover:bg-surface-raised/60"
                )}
              >
                <span className="text-sm font-semibold">{candidate.name}</span>
                <span className="text-[11px] tabular-nums text-ink-muted">
                  {candidateTicker ? formatPrice(tickerMid(candidateTicker), candidate.priceDecimals) : "—"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <Stat
            label="Mark price"
            value={price === undefined ? "—" : formatPrice(price, market.priceDecimals)}
            className="text-lg font-semibold text-ink"
          />
          <Stat
            label="24h change"
            value={change === undefined ? "—" : formatPercent(change)}
            className={change === undefined ? undefined : change >= 0 ? "text-long" : "text-short"}
          />
          <Stat label="24h high" value={day ? formatPrice(day.high, market.priceDecimals) : "—"} />
          <Stat label="24h low" value={day ? formatPrice(day.low, market.priceDecimals) : "—"} />
          <Stat label="Collateral" value={market.collateralToken.symbol} />
        </div>
      </div>
      <ApiBadge endpoints={["oracle.tickers", "oracle.24h"]} source="tradeMarketHeader" />
      {(tickers.error || dayStats.error) && (
        <p className="text-xs text-short">Market data failed to load. Check the API Inspector for the response.</p>
      )}
    </section>
  );
}
