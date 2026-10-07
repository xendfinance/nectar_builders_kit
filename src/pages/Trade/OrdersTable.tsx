import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useWallet } from "@/context/WalletContext";
import { useAccountOrders } from "@/hooks/queries";
import { formatDateTime, formatPrice, formatUsd, shortHash } from "@/lib/format";
import { findMarketByKey } from "@/lib/markets";
import { scaledToNumber } from "@/lib/units";

const MAX_ROWS = 25;

export function OrdersTable() {
  const { signer } = useWallet();
  const orders = useAccountOrders(signer?.address);

  return (
    <Card
      title="Your orders"
      endpoints={["account.orders"]}
      source="tradeOrders"
      bodyClassName="overflow-x-auto"
      actions={<span className="text-xs text-ink-faint">Public endpoint · no sign-in needed</span>}
    >
      {!signer && <EmptyState>Connect a wallet to see its orders.</EmptyState>}
      {signer && orders.error && (
        <div className="p-4">
          <ErrorState error={orders.error} />
        </div>
      )}
      {signer && !orders.data && !orders.error && <LoadingState />}
      {signer && orders.data?.length === 0 && <EmptyState>No orders yet. Place one above.</EmptyState>}
      {signer && orders.data && orders.data.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Market</th>
              <th>Side</th>
              <th className="num">Size</th>
              <th className="num">Price</th>
              <th>Status</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {orders.data.slice(0, MAX_ROWS).map((order) => {
              const market = findMarketByKey(order.market);
              return (
                <tr key={order.id}>
                  <td className="text-ink-muted">{formatDateTime(order.createdAt)}</td>
                  <td>{market?.name ?? shortHash(order.market)}</td>
                  <td className={order.isLong ? "text-long" : "text-short"}>{order.isLong ? "Long" : "Short"}</td>
                  <td className="num">{formatUsd(scaledToNumber(order.sizeDeltaUsd))}</td>
                  <td className="num" title="Acceptable price while open, execution price once executed">
                    {formatPrice(scaledToNumber(order.triggerPrice), market?.priceDecimals ?? 2)}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="font-mono text-ink-muted">{order.txHash ? shortHash(order.txHash) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
