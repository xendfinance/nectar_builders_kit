import { useState } from "react";

import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useBuilderTrades } from "@/hooks/queries";
import { formatDateTime, formatUsd, shortAddress, shortHash } from "@/lib/format";

const PAGE_SIZE = 10;

/** GMX order types, as reported in `orderType`. */
const ORDER_TYPE_LABELS: Record<number, string> = {
  0: "Market swap",
  1: "Limit swap",
  2: "Market increase",
  3: "Limit increase",
  4: "Market decrease",
  5: "Limit decrease",
  6: "Stop-loss",
  7: "Liquidation",
};

export function TradesTable() {
  const [page, setPage] = useState(1);
  const trades = useBuilderTrades(page, PAGE_SIZE, true);

  return (
    <Card
      title="Attributed trades"
      endpoints={["builder.trades"]}
      source="builderTrades"
      bodyClassName="overflow-x-auto"
    >
      {trades.error && (
        <div className="p-4">
          <ErrorState error={trades.error} />
        </div>
      )}
      {!trades.error && !trades.data && <LoadingState />}
      {trades.data && trades.data.items.length === 0 && <EmptyState>No attributed trades yet.</EmptyState>}
      {trades.data && trades.data.items.length > 0 && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Settled</th>
                <th>Trader</th>
                <th>Market</th>
                <th>Type</th>
                <th className="num">Size</th>
                <th className="num">Base fee</th>
                <th className="num">Builder fee</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {trades.data.items.map((trade) => (
                <tr key={trade.orderId}>
                  <td className="text-ink-muted">{formatDateTime(trade.settledAt)}</td>
                  <td className="font-mono" title={trade.account}>
                    {shortAddress(trade.account)}
                  </td>
                  <td>
                    {trade.marketSymbol}{" "}
                    <span className={trade.isLong ? "text-long" : "text-short"}>{trade.isLong ? "Long" : "Short"}</span>
                  </td>
                  <td className="text-ink-muted">{ORDER_TYPE_LABELS[trade.orderType] ?? `Type ${trade.orderType}`}</td>
                  <td className="num">{formatUsd(trade.sizeDeltaUsd)}</td>
                  <td className="num text-ink-muted">{formatUsd(trade.baseFeeUsd)}</td>
                  <td className="num text-info">{formatUsd(trade.builderFeeUsd)}</td>
                  <td className="font-mono text-ink-muted">{shortHash(trade.txHash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2">
            <Pagination page={page} pageSize={PAGE_SIZE} totalItems={trades.data.totalItems} onChange={setPage} />
          </div>
        </>
      )}
    </Card>
  );
}
