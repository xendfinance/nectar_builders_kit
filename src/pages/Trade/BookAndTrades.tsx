import clsx from "clsx";
import { useState } from "react";

import type { OrderbookLevel } from "@/api/types";
import { Card } from "@/components/Card";
import { Segmented } from "@/components/Segmented";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useOrderbook, useRecentTrades } from "@/hooks/queries";
import { formatTime } from "@/lib/format";
import type { MarketConfig } from "@/lib/markets";

const BOOK_LEVELS = 12;
const TRADE_COUNT = 30;

function BookRows({ levels, side, maxTotal }: { levels: OrderbookLevel[]; side: "bid" | "ask"; maxTotal: number }) {
  return (
    <>
      {levels.map((level) => {
        const depth = maxTotal > 0 ? (Number(level.totalInToken) / maxTotal) * 100 : 0;
        return (
          <div key={`${side}-${level.price}`} className="relative grid grid-cols-3 px-3 py-[3px] font-mono text-[11px]">
            <span
              aria-hidden
              className={clsx("absolute inset-y-0 right-0", side === "bid" ? "bg-long/10" : "bg-short/10")}
              style={{ width: `${depth}%` }}
            />
            <span className={clsx("relative", side === "bid" ? "text-long" : "text-short")}>{level.price}</span>
            <span className="relative text-right text-ink">{level.sizeInToken}</span>
            <span className="relative text-right text-ink-muted">{level.totalInToken}</span>
          </div>
        );
      })}
    </>
  );
}

function OrderBook({ market }: { market: MarketConfig }) {
  const book = useOrderbook(market.indexToken.symbol, BOOK_LEVELS);

  if (book.error)
    return (
      <div className="p-3">
        <ErrorState error={book.error} />
      </div>
    );
  if (!book.data) return <LoadingState />;

  const { bids, asks } = book.data;
  const maxTotal = Math.max(Number(bids.at(-1)?.totalInToken ?? 0), Number(asks.at(-1)?.totalInToken ?? 0));
  const bestBid = Number(bids[0]?.price);
  const bestAsk = Number(asks[0]?.price);
  const spread = bestAsk - bestBid;

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] text-ink-faint">
        <span>Price</span>
        <span className="text-right">Size ({market.indexToken.symbol})</span>
        <span className="text-right">Total</span>
      </div>
      {/* Asks arrive best (lowest) first; show them highest-first so the best ask sits next to the spread. */}
      <BookRows levels={[...asks].reverse()} side="ask" maxTotal={maxTotal} />
      <div className="border-y border-surface-line px-3 py-1.5 font-mono text-[11px] text-ink-muted">
        Spread {Number.isFinite(spread) ? spread.toFixed(market.priceDecimals) : "—"}
        {Number.isFinite(spread) && bestAsk > 0 && ` (${((spread / bestAsk) * 100).toFixed(3)}%)`}
      </div>
      <BookRows levels={bids} side="bid" maxTotal={maxTotal} />
    </div>
  );
}

function RecentTrades({ market }: { market: MarketConfig }) {
  const trades = useRecentTrades(market.indexToken.symbol, TRADE_COUNT);

  if (trades.error)
    return (
      <div className="p-3">
        <ErrorState error={trades.error} />
      </div>
    );
  if (!trades.data) return <LoadingState />;
  if (trades.data.length === 0) return <EmptyState>No recent trades.</EmptyState>;

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-3 px-3 py-1.5 text-[11px] text-ink-faint">
        <span>Price</span>
        <span className="text-right">Size ({market.indexToken.symbol})</span>
        <span className="text-right">Time</span>
      </div>
      {trades.data.map((trade, index) => {
        // The response carries no side, so colour by tick: compare with the previous (older) trade.
        const older = trades.data[index + 1];
        const isUptick = older === undefined || Number(trade.price) >= Number(older.price);
        return (
          <div key={trade.id} className="grid grid-cols-3 px-3 py-[3px] font-mono text-[11px]">
            <span className={isUptick ? "text-long" : "text-short"}>{trade.price}</span>
            <span className="text-right text-ink">{trade.sizeInToken}</span>
            <span className="text-right text-ink-muted">{formatTime(trade.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function BookAndTrades({ market }: { market: MarketConfig }) {
  const [tab, setTab] = useState<"book" | "trades">("book");

  return (
    <Card
      title={tab === "book" ? "Order book" : "Recent trades"}
      endpoints={[tab === "book" ? "market.orderbook" : "market.trades"]}
      source={tab === "book" ? "tradeOrderbook" : "tradeRecentTrades"}
      bodyClassName="max-h-[560px] overflow-auto"
      actions={
        <Segmented
          ariaLabel="Book or trades"
          value={tab}
          onChange={setTab}
          options={[
            { value: "book", label: "Book" },
            { value: "trades", label: "Trades" },
          ]}
        />
      }
    >
      {tab === "book" ? <OrderBook market={market} /> : <RecentTrades market={market} />}
    </Card>
  );
}
