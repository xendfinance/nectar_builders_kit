import { beforeEach, describe, expect, it } from "vitest";

import { setAccessToken, setTransport } from "@/api/client";
import { api } from "@/api/endpoints";
import { ApiError } from "@/api/errors";
import type { PrepareOrderPayload, PrepareOrderResponse } from "@/api/types";
import { DEMO_BUILDER_ID } from "@/config";
import { inspector } from "@/inspector/store";
import { DEMO_WALLETS } from "@/lib/demoWallets";
import type { DemoWalletId } from "@/lib/demoWallets";
import { DEFAULT_MARKET, MARKETS } from "@/lib/markets";
import { checkPreparedOrder } from "@/lib/orderChecks";
import { buildSiweMessage } from "@/lib/siwe";
import { parseUsd } from "@/lib/units";
import { createDemoSigner } from "@/lib/wallet";

import { BUILDER_SEEDS, EXECUTION_DELAY_MS, PREPARED_ORDER_TTL_MS } from "./fixtures";
import { createMockServer } from "./server";
import type { MockServer } from "./server";

const START = Date.parse("2026-10-07T12:00:00.000Z");
const SOURCE = "explorer" as const;
const FROZEN_BUILDER = BUILDER_SEEDS.find((seed) => seed.status === "frozen")!;

let clock = START;
let server: MockServer;

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status, code });
}

/** The same three steps the header's "Sign in" runs. */
async function signIn(walletId: DemoWalletId, builderId?: string) {
  const signer = createDemoSigner(walletId);
  const challenge = await api.auth.nonce({ address: signer.address, builderId }, SOURCE);
  const message = buildSiweMessage(challenge, signer.address, new Date(clock));
  const signature = await signer.signMessage(message);
  const session = await api.auth.verify({ message, signature }, SOURCE);
  setAccessToken(session.accessToken);
  return { challenge, session, signer };
}

function orderPayload(sizeUsd = "1000"): PrepareOrderPayload {
  return {
    marketKey: DEFAULT_MARKET.marketKey,
    collateralToken: DEFAULT_MARKET.collateralToken.address,
    sizeDeltaUsd: parseUsd(sizeUsd).toString(),
    isLong: true,
    orderType: 2,
  };
}

beforeEach(() => {
  clock = START;
  server = createMockServer({ now: () => clock, latencyMs: 0 });
  setTransport(server.transport);
  setAccessToken(undefined);
  inspector.clear();
});

describe("auth", () => {
  it("attributes a SIWE session to the builder passed on the nonce", async () => {
    const { challenge, session } = await signIn("trader", DEMO_BUILDER_ID);
    expect(challenge).toMatchObject({ builderId: DEMO_BUILDER_ID, builderName: "PerpDesk", version: "1" });
    expect(session).toMatchObject({ tokenType: "Bearer", address: DEMO_WALLETS.trader.address });

    const current = await api.auth.session(SOURCE);
    expect(current).toMatchObject({ builderId: DEMO_BUILDER_ID, builderName: "PerpDesk", builderFeeRateBps: 5 });
  });

  it("rejects unknown and frozen builders on the nonce", async () => {
    const address = DEMO_WALLETS.trader.address;
    await expectApiError(api.auth.nonce({ address, builderId: "not-a-uuid" }, SOURCE), 404, "UNKNOWN_BUILDER");
    await expectApiError(
      api.auth.nonce({ address, builderId: FROZEN_BUILDER.builderId }, SOURCE),
      403,
      "BUILDER_FROZEN"
    );
  });

  it("rejects a reused nonce and a signature from another wallet", async () => {
    const trader = createDemoSigner("trader");
    const challenge = await api.auth.nonce({ address: trader.address }, SOURCE);
    const message = buildSiweMessage(challenge, trader.address, new Date(clock));

    const forged = await createDemoSigner("builder").signMessage(message);
    await expectApiError(api.auth.verify({ message, signature: forged }, SOURCE), 401, "INVALID_SIGNATURE");

    const signature = await trader.signMessage(message);
    await api.auth.verify({ message, signature }, SOURCE);
    await expectApiError(api.auth.verify({ message, signature }, SOURCE), 401, "INVALID_NONCE");
  });

  it("requires a session for authed endpoints", async () => {
    await expectApiError(api.auth.session(SOURCE), 401, "UNAUTHORIZED");
  });
});

describe("orders", () => {
  it("injects base and builder fees and passes the pre-sign checks", async () => {
    await signIn("trader", DEMO_BUILDER_ID);
    const payload = orderPayload("1000");
    const prepared = await api.orders.prepare(payload, SOURCE);

    expect(prepared.feeBreakdown).toEqual({
      baseFeeRateBps: 2,
      builderFeeRateBps: 5,
      totalFeeRateBps: 7,
      baseFeeAmountUsd: "0.20",
      builderFeeAmountUsd: "0.50",
      totalFeeAmountUsd: "0.70",
      builderName: "PerpDesk",
      uiFeeReceiver: DEMO_WALLETS.builder.address,
    });
    const intent = { ...payload, sizeDeltaUsd: BigInt(payload.sizeDeltaUsd), orderType: 2 };
    expect(checkPreparedOrder(intent, prepared, clock)).toEqual([]);
    expect(checkPreparedOrder({ ...intent, isLong: false }, prepared, clock)).toHaveLength(1);
  });

  it("charges no builder fee without attribution", async () => {
    await signIn("trader");
    const prepared = await api.orders.prepare(orderPayload(), SOURCE);
    expect(prepared.feeBreakdown).toMatchObject({
      builderFeeRateBps: 0,
      builderFeeAmountUsd: "0.00",
      builderName: null,
    });
    expect(prepared.eip712Payload.message.uiFeeReceiver).toBe("0x0000000000000000000000000000000000000000");
  });

  it("validates the order body", async () => {
    await signIn("trader", DEMO_BUILDER_ID);
    await expectApiError(api.orders.prepare({ ...orderPayload(), marketKey: "0x1" }, SOURCE), 400, "INVALID_MARKET");
    await expectApiError(api.orders.prepare(orderPayload("5"), SOURCE), 400, "INVALID_SIZE");
    await expectApiError(api.orders.prepare({ ...orderPayload(), orderType: 3 }, SOURCE), 400, "INVALID_ORDER_TYPE");
  });

  it("only accepts a signature over the payload exactly as prepared", async () => {
    const { signer } = await signIn("trader", DEMO_BUILDER_ID);
    const prepared = await api.orders.prepare(orderPayload(), SOURCE);

    // A client that lowers the builder fee before signing.
    const tampered: PrepareOrderResponse["eip712Payload"] = {
      ...prepared.eip712Payload,
      message: { ...prepared.eip712Payload.message, builderFeeAmountUsd: "0" },
    };
    const badSignature = await signer.signTypedData(tampered);
    await expectApiError(
      api.orders.submit({ orderId: prepared.orderId, signature: badSignature }, SOURCE),
      400,
      "SIGNATURE_MISMATCH"
    );

    const signature = await signer.signTypedData(prepared.eip712Payload);
    const submitted = await api.orders.submit({ orderId: prepared.orderId, signature }, SOURCE);
    expect(submitted).toMatchObject({ orderId: prepared.orderId, status: "submitted" });
    await expectApiError(
      api.orders.submit({ orderId: prepared.orderId, signature }, SOURCE),
      409,
      "ORDER_ALREADY_SUBMITTED"
    );
  });

  it("rejects an expired quote", async () => {
    const { signer } = await signIn("trader", DEMO_BUILDER_ID);
    const prepared = await api.orders.prepare(orderPayload(), SOURCE);
    const signature = await signer.signTypedData(prepared.eip712Payload);
    clock += PREPARED_ORDER_TTL_MS;
    await expectApiError(api.orders.submit({ orderId: prepared.orderId, signature }, SOURCE), 410, "ORDER_EXPIRED");
  });

  it("executes the order and credits the builder's fees", async () => {
    await signIn("builder");
    const before = await api.builder.stats({ period: "24h" }, SOURCE);

    const { signer } = await signIn("trader", DEMO_BUILDER_ID);
    const prepared = await api.orders.prepare(orderPayload("2000"), SOURCE);
    const signature = await signer.signTypedData(prepared.eip712Payload);
    await api.orders.submit({ orderId: prepared.orderId, signature }, SOURCE);

    const [open] = await api.account.orders(signer.address, SOURCE);
    expect(open).toMatchObject({ status: "OPEN", sizeDeltaUsd: parseUsd("2000").toString() });

    clock += EXECUTION_DELAY_MS;
    const [executed] = await api.account.orders(signer.address, SOURCE);
    expect(executed).toMatchObject({ id: open?.id, status: "EXECUTED" });

    await signIn("builder");
    const after = await api.builder.stats({ period: "24h" }, SOURCE);
    expect(after.stats?.tradeCount).toBe((before.stats?.tradeCount ?? 0) + 1);
    expect(after.stats?.builderFeeEarnedUsd).toBeCloseTo((before.stats?.builderFeeEarnedUsd ?? 0) + 1, 2);

    const trades = await api.builder.trades({ account: signer.address, pageSize: 1 }, SOURCE);
    expect(trades.items[0]).toMatchObject({ orderId: prepared.orderId, builderFeeUsd: 1, baseFeeUsd: 0.4 });
  });
});

describe("builder dashboard", () => {
  it("rejects a wallet that is not a builder", async () => {
    await signIn("trader");
    await expectApiError(api.builder.me(SOURCE), 403, "NOT_A_BUILDER");
  });

  it("serves stats that agree with the trades list", async () => {
    await signIn("builder");
    const me = await api.builder.me(SOURCE);
    expect(me).toMatchObject({ builderId: DEMO_BUILDER_ID, name: "PerpDesk", status: "active" });

    const all = await api.builder.trades({ pageSize: 100 }, SOURCE);
    expect(all.totalItems).toBe(me.stats?.allTime?.tradeCount);
    expect(all).not.toHaveProperty("lastPage");

    const users = await api.builder.users({ sortBy: "tradeCount", order: "desc", pageSize: 5 }, SOURCE);
    expect(users.lastPage).toBe(Math.ceil(users.totalItems / 5));
    expect(users.totalItems).toBe(me.stats?.allTime?.uniqueUsers);
    const counts = users.items.map((user) => user.tradeCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("lets a builder change its fee rate within its cap only", async () => {
    await signIn("builder");
    await expectApiError(api.builder.update(DEMO_BUILDER_ID, { feeRateBps: 11 }, SOURCE), 400, "INVALID_FEE_RATE");
    await expectApiError(api.builder.update(DEMO_BUILDER_ID, { feeCapBps: 5 } as never, SOURCE), 403, "FORBIDDEN");

    const updated = await api.builder.update(DEMO_BUILDER_ID, { feeRateBps: 3, description: "New" }, SOURCE);
    expect(updated).toMatchObject({ feeRateBps: 3, changedFields: ["feeRateBps", "description"] });

    await signIn("trader", DEMO_BUILDER_ID);
    expect((await api.auth.session(SOURCE)).builderFeeRateBps).toBe(3);
    await expectApiError(api.builder.update(DEMO_BUILDER_ID, { feeRateBps: 1 }, SOURCE), 403, "FORBIDDEN");
  });
});

describe("market data", () => {
  it("serves candles that are ordered, well-formed and end at the live price", async () => {
    for (const market of MARKETS) {
      const { symbol } = market.indexToken;
      const { candles } = await api.market.candles({ tokenSymbol: symbol, period: "15m", limit: 120 }, SOURCE);
      expect(candles).toHaveLength(120);

      candles.forEach(([time, open, high, low, close], index) => {
        expect(time % (15 * 60)).toBe(0);
        if (index > 0) expect(time).toBeGreaterThan(candles[index - 1]![0]);
        expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
        expect(low).toBeLessThanOrEqual(Math.min(open, close));
        expect(low).toBeGreaterThan(0);
      });

      const [ticker] = await api.market.tickers([symbol], SOURCE);
      const mid = (Number(ticker!.minPrice) + Number(ticker!.maxPrice)) / 2 / 10 ** ticker!.oracleDecimals;
      expect(candles.at(-1)![4]).toBeCloseTo(mid, market.priceDecimals);
    }
  });

  it("returns the same trades history across polls and a sorted book", async () => {
    const first = await api.market.trades("WETH", 20, SOURCE);
    clock += 1_000;
    const second = await api.market.trades("WETH", 20, SOURCE);
    const shared = second.filter((trade) => first.some((other) => other.id === trade.id));
    shared.forEach((trade) => expect(trade).toEqual(first.find((other) => other.id === trade.id)));

    const book = await api.market.orderbook("WBTC", 10, SOURCE);
    const bids = book.bids.map((level) => Number(level.price));
    const asks = book.asks.map((level) => Number(level.price));
    expect(bids).toEqual([...bids].sort((a, b) => b - a));
    expect(asks).toEqual([...asks].sort((a, b) => a - b));
    expect(Math.max(...bids)).toBeLessThan(Math.min(...asks));
  });

  it("returns 24h stats whose open and close lie within high and low", async () => {
    const stats = await api.market.dayStats(["WETH", "WBTC", "CNGN"], SOURCE);
    expect(stats).toHaveLength(3);
    for (const day of stats) {
      expect(day.high).toBeGreaterThanOrEqual(Math.max(day.open, day.close));
      expect(day.low).toBeLessThanOrEqual(Math.min(day.open, day.close));
    }
  });
});

describe("api inspector", () => {
  it("records every call with its source, status and response", async () => {
    await expectApiError(api.builder.me("builderProfile"), 401, "UNAUTHORIZED");
    await api.market.tickers(["WETH"], "tradeMarketHeader");

    const [latest, failed] = inspector.getState().records;
    expect(latest).toMatchObject({
      endpointId: "oracle.tickers",
      source: "tradeMarketHeader",
      state: "success",
      status: 200,
      path: "/oracle-keeper/prices/tickers?symbols=WETH",
    });
    expect(failed).toMatchObject({ endpointId: "builder.me", source: "builderProfile", state: "error", status: 401 });
  });

  it("never shows the full bearer token", async () => {
    const { session } = await signIn("trader");
    await api.auth.session(SOURCE);
    const [record] = inspector.getState().records;
    expect(record?.requestHeaders.Authorization).not.toContain(session.accessToken);
  });
});
