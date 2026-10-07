import { useState } from "react";

import { DEFAULT_MARKET } from "@/lib/markets";

import { AttributionCard } from "./AttributionCard";
import { BookAndTrades } from "./BookAndTrades";
import { MarketHeader } from "./MarketHeader";
import { OrderForm } from "./OrderForm";
import { OrdersTable } from "./OrdersTable";
import { PriceChart } from "./PriceChart";

/**
 * The trading interface a builder ships to its users. Every panel is wired to one or two endpoints, shown as badges
 * on the panel; click one to see its requests and responses in the API Inspector.
 */
export function TradePage() {
  const [market, setMarket] = useState(DEFAULT_MARKET);

  return (
    <div className="flex flex-col gap-4">
      <MarketHeader market={market} onSelect={setMarket} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px_340px]">
        <PriceChart market={market} />
        <BookAndTrades market={market} />
        <div className="flex flex-col gap-4">
          {/* Remount per market so a review for one market can never be confirmed on another. */}
          <OrderForm key={market.marketKey} market={market} />
          <AttributionCard />
        </div>
      </div>
      <OrdersTable />
    </div>
  );
}
