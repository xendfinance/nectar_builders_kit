import { getAddress } from "viem";

import type {
  AccountOrderItem,
  AuthTrader,
  BuilderProfileResponse,
  BuilderStatsBucket,
  BuilderTradeItem,
  BuilderUserItem,
  BuilderUsersParams,
  BuilderUsersSortBy,
  Eip712Payload,
  OrderFeeBreakdown,
  Paginated,
  PaginationParams,
  StatsPeriod,
} from "@/api/types";
import { CHAIN_ID } from "@/config";
import { DEMO_WALLETS } from "@/lib/demoWallets";
import { MARKETS } from "@/lib/markets";
import type { MarketConfig } from "@/lib/markets";
import { formatScaled, numberToScaled, scaledToNumber } from "@/lib/units";

import { BUILDER_SEEDS, MOCK_BASE_FEE_BPS } from "./fixtures";
import type { BuilderSeed } from "./fixtures";
import type { PriceFeed } from "./priceFeed";
import { createRandom, pick, randomHex, randomUuid } from "./random";
import type { Random } from "./random";

/** In-memory state of the mock backend. Lives until the page reloads. */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Weighted toward increases: MarketIncrease(2), LimitIncrease(3), MarketDecrease(4), LimitDecrease(5), StopLoss(6). */
const SEED_ORDER_TYPES = [2, 2, 2, 3, 4, 4, 5, 6];

export type BuilderProfile = Omit<BuilderProfileResponse, "stats">;

export interface MockBuilder {
  profile: BuilderProfile;
  /** Newest first. */
  trades: BuilderTradeItem[];
  /** Share of attributed trade count that the same users also trade directly, for `directTrades`. */
  directTradeRatio: number;
}

export interface MockNonce {
  nonce: string;
  address: string;
  builderId: string | null;
  expiresAtMs: number;
  used: boolean;
}

export interface MockSession {
  token: string;
  address: string;
  builderId: string | null;
  chainId: number;
  expiresAtMs: number;
}

export interface PreparedOrder {
  orderId: string;
  account: string;
  builderId: string | null;
  market: MarketConfig;
  isLong: boolean;
  orderType: number;
  sizeDeltaUsd: bigint;
  acceptablePrice: bigint;
  baseFee: bigint;
  builderFee: bigint;
  payload: Eip712Payload;
  feeBreakdown: OrderFeeBreakdown;
  expiresAtMs: number;
  submitted: boolean;
}

interface PendingExecution {
  prepared: PreparedOrder;
  order: AccountOrderItem;
  executeAtMs: number;
}

export interface MockDb {
  random: Random;
  feed: PriceFeed;
  builders: MockBuilder[];
  traders: Map<string, AuthTrader>;
  nonces: Map<string, MockNonce>;
  sessions: Map<string, MockSession>;
  prepared: Map<string, PreparedOrder>;
  /** Keyed by lower-cased account. Newest first. */
  accountOrders: Map<string, AccountOrderItem[]>;
  pending: PendingExecution[];
  nextOrderId: number;
  nextTraderId: number;
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100;
}

function sumBy<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function randomAddress(random: Random) {
  return getAddress(`0x${randomHex(random, 20)}`);
}

function byNewest<T>(getTime: (item: T) => string) {
  return (a: T, b: T) => Date.parse(getTime(b)) - Date.parse(getTime(a));
}

function feeUsd(sizeUsd: number, bps: number) {
  return roundUsd((sizeUsd * bps) / 10_000);
}

function createBuilder(random: Random, seed: BuilderSeed, generatedAt: number): MockBuilder {
  const registeredMs = generatedAt - seed.ageDays * DAY_MS;
  const walletAddress = seed.walletAddress ?? randomAddress(random);
  const accounts = Array.from({ length: seed.userCount }, () => randomAddress(random));
  if (seed.walletAddress === DEMO_WALLETS.builder.address) {
    // The demo trader is one of the demo builder's users, so its order history has attributed trades.
    accounts[0] = DEMO_WALLETS.trader.address;
  }

  const trades = Array.from({ length: seed.tradeCount }, (): BuilderTradeItem => {
    // Skewed toward recent activity so the 24h, 7d and 30d windows all have trades.
    const settledAt = generatedAt - Math.pow(random(), 2.2) * (generatedAt - registeredMs);
    const sizeDeltaUsd = roundUsd(400 + Math.pow(random(), 3) * 60_000);
    const baseFeeUsd = feeUsd(sizeDeltaUsd, MOCK_BASE_FEE_BPS);
    const builderFeeUsd = feeUsd(sizeDeltaUsd, seed.feeRateBps);
    const market = pick(random, MARKETS);

    return {
      orderId: randomUuid(random),
      txHash: `0x${randomHex(random, 32)}`,
      account: pick(random, accounts),
      marketKey: market.marketKey,
      marketSymbol: market.name,
      isLong: random() > 0.45,
      orderType: pick(random, SEED_ORDER_TYPES),
      sizeDeltaUsd,
      baseFeeUsd,
      builderFeeUsd,
      totalFeeUsd: roundUsd(baseFeeUsd + builderFeeUsd),
      status: "EXECUTED",
      settledAt: new Date(Math.floor(settledAt)).toISOString(),
      chainId: CHAIN_ID,
    };
  }).sort(byNewest((trade) => trade.settledAt));

  return {
    profile: {
      builderId: seed.builderId,
      name: seed.name,
      walletAddress,
      feeRateBps: seed.feeRateBps,
      feeCapBps: seed.feeCapBps,
      status: seed.status,
      registeredAt: new Date(registeredMs).toISOString(),
      contactEmail: seed.contactEmail,
      description: seed.description,
    },
    trades,
    directTradeRatio: 0.3 + random() * 0.4,
  };
}

/** Each seeded builder trade also exists as an executed order in its trader's order history. */
function seedAccountOrders(db: MockDb) {
  const random = createRandom(7);
  const orders: AccountOrderItem[] = [];

  for (const builder of db.builders) {
    for (const trade of builder.trades) {
      const market = MARKETS.find((candidate) => candidate.marketKey === trade.marketKey) as MarketConfig;
      const settledMs = Date.parse(trade.settledAt);
      orders.push({
        id: 0,
        key: `0x${randomHex(random, 32)}`,
        account: trade.account,
        market: trade.marketKey,
        isLong: trade.isLong,
        sizeDeltaUsd: numberToScaled(trade.sizeDeltaUsd).toString(),
        triggerPrice: numberToScaled(db.feed.priceAt(market.indexToken.symbol, settledMs)).toString(),
        status: "EXECUTED",
        txHash: trade.txHash,
        createdAt: new Date(settledMs - 3_000).toISOString(),
        updatedAt: trade.settledAt,
      });
    }
  }

  orders.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  orders.forEach((order, index) => {
    order.id = index + 1;
    const key = order.account.toLowerCase();
    db.accountOrders.set(key, [order, ...(db.accountOrders.get(key) ?? [])]);
  });
  db.nextOrderId = orders.length + 1;
}

export function createMockDb(feed: PriceFeed, nowMs: number, seed: number): MockDb {
  const random = createRandom(seed);
  const db: MockDb = {
    random,
    feed,
    builders: BUILDER_SEEDS.map((builderSeed) => createBuilder(random, builderSeed, nowMs)),
    traders: new Map(),
    nonces: new Map(),
    sessions: new Map(),
    prepared: new Map(),
    accountOrders: new Map(),
    pending: [],
    nextOrderId: 1,
    nextTraderId: 1,
  };
  seedAccountOrders(db);
  return db;
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

export function findBuilderById(db: MockDb, builderId: string): MockBuilder | undefined {
  return db.builders.find((builder) => builder.profile.builderId === builderId);
}

export function findBuilderByWallet(db: MockDb, address: string): MockBuilder | undefined {
  return db.builders.find((builder) => builder.profile.walletAddress.toLowerCase() === address.toLowerCase());
}

// ─── Order lifecycle ─────────────────────────────────────────────────────────

export function queueExecution(db: MockDb, prepared: PreparedOrder, txHash: string, nowMs: number, delayMs: number) {
  const order: AccountOrderItem = {
    id: db.nextOrderId++,
    key: `0x${randomHex(db.random, 32)}`,
    account: prepared.account,
    market: prepared.market.marketKey,
    isLong: prepared.isLong,
    sizeDeltaUsd: prepared.sizeDeltaUsd.toString(),
    triggerPrice: prepared.acceptablePrice.toString(),
    status: "OPEN",
    txHash,
    createdAt: new Date(nowMs).toISOString(),
    updatedAt: new Date(nowMs).toISOString(),
  };
  const key = prepared.account.toLowerCase();
  db.accountOrders.set(key, [order, ...(db.accountOrders.get(key) ?? [])]);
  db.pending.push({ prepared, order, executeAtMs: nowMs + delayMs });
}

/**
 * Simulated keeper: runs lazily on every read, so no timers are needed. A market order fills at the oracle price
 * at execution time if that price is within `acceptablePrice`; otherwise it is cancelled and earns no fees.
 */
export function settleDueOrders(db: MockDb, nowMs: number) {
  const due = db.pending.filter((item) => item.executeAtMs <= nowMs);
  if (due.length === 0) {
    return;
  }
  db.pending = db.pending.filter((item) => item.executeAtMs > nowMs);

  for (const { prepared, order, executeAtMs } of due) {
    const executionPrice = db.feed.priceAt(prepared.market.indexToken.symbol, executeAtMs);
    const acceptable = scaledToNumber(prepared.acceptablePrice);
    const isFillable = prepared.isLong ? executionPrice <= acceptable : executionPrice >= acceptable;

    order.status = isFillable ? "EXECUTED" : "CANCELLED";
    order.updatedAt = new Date(executeAtMs).toISOString();
    if (!isFillable) {
      continue;
    }
    order.triggerPrice = numberToScaled(executionPrice).toString();

    const builder = prepared.builderId === null ? undefined : findBuilderById(db, prepared.builderId);
    if (!builder) {
      continue;
    }
    const baseFeeUsd = Number(formatScaled(prepared.baseFee, 2));
    const builderFeeUsd = Number(formatScaled(prepared.builderFee, 2));
    builder.trades.unshift({
      orderId: prepared.orderId,
      txHash: order.txHash ?? "",
      account: prepared.account,
      marketKey: prepared.market.marketKey,
      marketSymbol: prepared.market.name,
      isLong: prepared.isLong,
      orderType: prepared.orderType,
      sizeDeltaUsd: Number(formatScaled(prepared.sizeDeltaUsd, 2)),
      baseFeeUsd,
      builderFeeUsd,
      totalFeeUsd: roundUsd(baseFeeUsd + builderFeeUsd),
      status: "EXECUTED",
      settledAt: order.updatedAt,
      chainId: CHAIN_ID,
    });
    builder.trades.sort(byNewest((trade) => trade.settledAt));
  }
}

// ─── Stats over trades ───────────────────────────────────────────────────────

const PERIOD_WINDOW_MS: Record<StatsPeriod, number | undefined> = {
  all: undefined,
  "30d": 30 * DAY_MS,
  "7d": 7 * DAY_MS,
  "24h": DAY_MS,
};

export function tradesInPeriod(trades: BuilderTradeItem[], period: StatsPeriod, nowMs: number) {
  const windowMs = PERIOD_WINDOW_MS[period];
  return windowMs === undefined ? trades : trades.filter((trade) => Date.parse(trade.settledAt) >= nowMs - windowMs);
}

export function summarizeTrades(trades: BuilderTradeItem[]): BuilderStatsBucket {
  return {
    tradeCount: trades.length,
    volumeUsd: roundUsd(sumBy(trades, (trade) => trade.sizeDeltaUsd)),
    builderFeeEarnedUsd: roundUsd(sumBy(trades, (trade) => trade.builderFeeUsd)),
    uniqueUsers: new Set(trades.map((trade) => trade.account.toLowerCase())).size,
  };
}

export function sumBaseFees(trades: BuilderTradeItem[]) {
  return roundUsd(sumBy(trades, (trade) => trade.baseFeeUsd));
}

export function withStats(builder: MockBuilder, nowMs: number): BuilderProfileResponse {
  return {
    ...builder.profile,
    stats: {
      allTime: summarizeTrades(builder.trades),
      last30d: summarizeTrades(tradesInPeriod(builder.trades, "30d", nowMs)),
      last7d: summarizeTrades(tradesInPeriod(builder.trades, "7d", nowMs)),
      last24h: summarizeTrades(tradesInPeriod(builder.trades, "24h", nowMs)),
    },
  };
}

export function aggregateUsers(trades: BuilderTradeItem[]): BuilderUserItem[] {
  const users = new Map<string, BuilderUserItem>();

  for (const trade of trades) {
    const key = trade.account.toLowerCase();
    const user = users.get(key);
    if (!user) {
      users.set(key, {
        account: trade.account,
        firstSeen: trade.settledAt,
        lastSeen: trade.settledAt,
        tradeCount: 1,
        volumeUsd: trade.sizeDeltaUsd,
        builderFeeGeneratedUsd: trade.builderFeeUsd,
        baseFeeGeneratedUsd: trade.baseFeeUsd,
      });
      continue;
    }
    user.tradeCount += 1;
    user.volumeUsd = roundUsd(user.volumeUsd + trade.sizeDeltaUsd);
    user.builderFeeGeneratedUsd = roundUsd(user.builderFeeGeneratedUsd + trade.builderFeeUsd);
    user.baseFeeGeneratedUsd = roundUsd(user.baseFeeGeneratedUsd + trade.baseFeeUsd);
    if (Date.parse(trade.settledAt) < Date.parse(user.firstSeen)) user.firstSeen = trade.settledAt;
    if (Date.parse(trade.settledAt) > Date.parse(user.lastSeen)) user.lastSeen = trade.settledAt;
  }
  return Array.from(users.values());
}

const USER_SORT_VALUE: Record<BuilderUsersSortBy, (user: BuilderUserItem) => number> = {
  volumeUsd: (user) => user.volumeUsd,
  tradeCount: (user) => user.tradeCount,
  feeGenerated: (user) => user.builderFeeGeneratedUsd,
  firstSeen: (user) => Date.parse(user.firstSeen),
};

export function sortUsers(users: BuilderUserItem[], { sortBy = "volumeUsd", order = "desc" }: BuilderUsersParams) {
  const getValue = USER_SORT_VALUE[sortBy];
  const direction = order === "asc" ? 1 : -1;
  return [...users].sort((a, b) => (getValue(a) - getValue(b)) * direction);
}

export function paginate<T>(items: T[], { page = 1, pageSize = 20 }: PaginationParams, includeLastPage: boolean) {
  const size = Math.min(Math.max(1, pageSize), 100);
  const currentPage = Math.max(1, page);
  const start = (currentPage - 1) * size;
  const result: Paginated<T> = {
    items: items.slice(start, start + size),
    totalItems: items.length,
    page: currentPage,
    pageSize: size,
  };
  if (includeLastPage) {
    result.lastPage = Math.max(1, Math.ceil(items.length / size));
  }
  return result;
}
