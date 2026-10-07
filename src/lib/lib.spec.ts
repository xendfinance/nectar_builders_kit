import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import type { BuilderTradeItem, Eip712Payload } from "@/api/types";
import { DEMO_BUILDER_ID, isValidBuilderId } from "@/config";
import { BUILDER_SEEDS } from "@/mock/fixtures";

import { DEMO_WALLETS } from "./demoWallets";
import { getPrimaryType, toTypedData } from "./eip712";
import { bucketTrades, getFromTimestamp, getSeriesWindow } from "./feeSeries";
import { applyBps, formatScaled, numberToScaled, parseUsd, scaledToNumber } from "./units";

describe("demo wallets", () => {
  it.each(Object.values(DEMO_WALLETS))("$id address is derived from its private key", (wallet) => {
    expect(privateKeyToAccount(wallet.privateKey).address).toBe(wallet.address);
  });
});

describe("builder IDs", () => {
  it("every seeded builder ID is a v4 UUID and the demo builder is first", () => {
    for (const seed of BUILDER_SEEDS) {
      expect(isValidBuilderId(seed.builderId)).toBe(true);
    }
    expect(BUILDER_SEEDS[0]?.builderId).toBe(DEMO_BUILDER_ID);
    expect(new Set(BUILDER_SEEDS.map((seed) => seed.builderId)).size).toBe(BUILDER_SEEDS.length);
  });
});

describe("units", () => {
  it("parses and formats USD with 30 decimals", () => {
    expect(parseUsd("1000")).toBe(10n ** 33n);
    expect(formatScaled(parseUsd("1234.565"), 2)).toBe("1234.57");
    expect(formatScaled(parseUsd("0.004"), 2)).toBe("0.00");
    expect(formatScaled(parseUsd("0.005"), 2)).toBe("0.01");
    expect(formatScaled(parseUsd("7"), 0)).toBe("7");
    expect(formatScaled(-parseUsd("1.5"), 1)).toBe("-1.5");
  });

  it("applies basis points", () => {
    expect(formatScaled(applyBps(parseUsd("1000"), 5), 2)).toBe("0.50");
    expect(formatScaled(applyBps(parseUsd("1000"), 2), 2)).toBe("0.20");
    expect(applyBps(parseUsd("1000"), 0)).toBe(0n);
  });

  it("converts numbers to scaled integers and back", () => {
    expect(scaledToNumber(numberToScaled(2450.12))).toBeCloseTo(2450.12, 9);
    expect(scaledToNumber(numberToScaled(0.000652))).toBeCloseTo(0.000652, 12);
    expect(() => numberToScaled(-1)).toThrow();
  });
});

describe("eip712", () => {
  const payload: Eip712Payload = {
    domain: {
      name: "Test",
      version: "1",
      chainId: 42421,
      verifyingContract: "0x0000000000000000000000000000000000004e43",
    },
    types: {
      Order: [
        { name: "sizeDeltaUsd", type: "uint256" },
        { name: "isLong", type: "bool" },
        { name: "orderType", type: "uint8" },
      ],
    },
    message: {
      marketKey: "0x87416dbb72D770622465f0F9Fac690e9c41529cC",
      collateralToken: "0x7E3137e20150f9dE23830597E1F15D432853d67F",
      sizeDeltaUsd: "1000",
      isLong: true,
      orderType: 2,
      acceptablePrice: "0",
      uiFeeReceiver: "0x0000000000000000000000000000000000000000",
      baseFeeAmountUsd: "0",
      builderFeeAmountUsd: "0",
      nonce: "1",
      expiry: 1,
    },
  };

  it("finds the primary type and converts integers to bigint", () => {
    const typed = toTypedData(payload);
    expect(typed.primaryType).toBe("Order");
    expect(typed.message).toEqual({ sizeDeltaUsd: 1000n, isLong: true, orderType: 2n });
  });

  it("ignores EIP712Domain and rejects ambiguous type sets", () => {
    expect(getPrimaryType({ EIP712Domain: [], Order: [] })).toBe("Order");
    expect(getPrimaryType({ Order: [{ name: "fee", type: "Fee" }], Fee: [] })).toBe("Order");
    expect(() => getPrimaryType({ A: [], B: [] })).toThrow();
  });
});

describe("fee series", () => {
  const now = Date.parse("2026-10-07T12:00:00.000Z");
  const trade = (hoursAgo: number, builderFeeUsd: number): BuilderTradeItem => ({
    orderId: String(hoursAgo),
    txHash: "0x",
    account: "0x",
    marketKey: "0x",
    marketSymbol: "ETH/USD",
    isLong: true,
    orderType: 2,
    sizeDeltaUsd: 1000,
    baseFeeUsd: 0.2,
    builderFeeUsd,
    totalFeeUsd: 0.2 + builderFeeUsd,
    status: "EXECUTED",
    settledAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
    chainId: 42421,
  });

  it("builds 24 hourly buckets ending now and drops older trades", () => {
    const window = getSeriesWindow("24h", now, now - 90 * 86_400_000);
    expect(window).toMatchObject({ interval: "hour", count: 24, startMs: now - 86_400_000 });
    expect(getFromTimestamp("24h", window)).toBe((now - 86_400_000) / 1000);

    const points = bucketTrades([trade(0, 0.5), trade(0.5, 0.25), trade(23.5, 1), trade(25, 9)], window);
    expect(points).toHaveLength(24);
    expect(points[23]).toMatchObject({ tradeCount: 2, builderFeeUsd: 0.75 });
    expect(points[0]).toMatchObject({ tradeCount: 1, builderFeeUsd: 1 });
    expect(points.reduce((sum, point) => sum + point.tradeCount, 0)).toBe(3);
  });

  it("uses weekly buckets since registration for all time", () => {
    const window = getSeriesWindow("all", now, now - 20 * 86_400_000);
    expect(window).toMatchObject({ interval: "week", count: 3 });
    expect(getFromTimestamp("all", window)).toBeUndefined();
  });
});
