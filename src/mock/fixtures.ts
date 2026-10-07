import { getAddress } from "viem";

import type { BuilderStatus } from "@/api/types";
import { DEMO_BUILDER_ID } from "@/config";
import { DEMO_WALLETS } from "@/lib/demoWallets";

/**
 * Mock-only economics and seed data. None of these values are protocol constants: the real backend decides fees.
 */

/** Protocol base fee the mock charges on every order, in bps of size. */
export const MOCK_BASE_FEE_BPS = 2;

/** Builder statuses whose attribution is accepted at sign-in and charged at /orders/prepare. */
export const FEE_ACCRUING_STATUSES: BuilderStatus[] = ["active", "rate_limited"];

/** Minimum order size, USD. */
export const MOCK_MIN_ORDER_USD = 10;

/** How long a prepared order can be signed and submitted. */
export const PREPARED_ORDER_TTL_MS = 60_000;

/** Delay between /orders/submit and the simulated keeper execution. */
export const EXECUTION_DELAY_MS = 4_000;

export const NONCE_TTL_MS = 5 * 60_000;
export const SESSION_TTL_S = 24 * 60 * 60;

/** Placeholder `verifyingContract` for the order relay; the real address comes from the backend. */
export const MOCK_ORDER_RELAY = getAddress("0x0000000000000000000000000000000000004e43");

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const MOCK_SEED = 42421;

export const HISTORY_DAYS = 90;

export interface MarketSimulation {
  /** Price at app start. */
  referencePrice: number;
  /** Annualised volatility. */
  annualVolatility: number;
}

export const MARKET_SIMULATION: Record<string, MarketSimulation> = {
  WETH: { referencePrice: 2450, annualVolatility: 0.65 },
  WBTC: { referencePrice: 61800, annualVolatility: 0.5 },
  CNGN: { referencePrice: 0.000652, annualVolatility: 0.18 },
};

export const STABLE_SYMBOLS = ["USDC", "USDT"];

export interface BuilderSeed {
  builderId: string;
  name: string;
  /** Fixed for the demo builder so the "Demo builder" wallet owns its dashboard; random otherwise. */
  walletAddress?: string;
  feeRateBps: number;
  feeCapBps: number;
  status: BuilderStatus;
  contactEmail: string;
  description: string;
  tradeCount: number;
  userCount: number;
  ageDays: number;
}

export const BUILDER_SEEDS: BuilderSeed[] = [
  {
    builderId: DEMO_BUILDER_ID,
    name: "PerpDesk",
    walletAddress: DEMO_WALLETS.builder.address,
    feeRateBps: 5,
    feeCapBps: 10,
    status: "active",
    contactEmail: "dev@perpdesk.example",
    description: "Pro trading terminal with advanced order routing.",
    tradeCount: 240,
    userCount: 46,
    ageDays: 88,
  },
  {
    builderId: "c2b3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    name: "YieldLens",
    feeRateBps: 3,
    feeCapBps: 8,
    status: "active",
    contactEmail: "team@yieldlens.example",
    description: "Portfolio analytics with one-click position management.",
    tradeCount: 180,
    userCount: 38,
    ageDays: 75,
  },
  {
    builderId: "d3c4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f",
    name: "Orbit Wallet",
    feeRateBps: 4,
    feeCapBps: 10,
    status: "active",
    contactEmail: "partners@orbitwallet.example",
    description: "Mobile wallet with built-in perpetuals trading.",
    tradeCount: 150,
    userCount: 52,
    ageDays: 64,
  },
  {
    builderId: "e4d5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f80",
    name: "Kite Mobile",
    feeRateBps: 5,
    feeCapBps: 10,
    status: "rate_limited",
    contactEmail: "support@kitemobile.example",
    description: "Lightweight trading app for emerging markets.",
    tradeCount: 70,
    userCount: 29,
    ageDays: 33,
  },
  {
    builderId: "f5e6a7b8-c9d0-4e1f-8a3b-4c5d6e7f8091",
    name: "Lumen Bot",
    feeRateBps: 8,
    feeCapBps: 10,
    status: "frozen",
    contactEmail: "admin@lumenbot.example",
    description: "Telegram trading bot.",
    tradeCount: 60,
    userCount: 9,
    ageDays: 26,
  },
  {
    builderId: "a6f7b8c9-d0e1-4f2a-9b4c-5d6e7f8091a2",
    name: "Swiftfill",
    feeRateBps: 10,
    feeCapBps: 10,
    status: "blacklisted",
    contactEmail: "contact@swiftfill.example",
    description: "Automated order execution service.",
    tradeCount: 35,
    userCount: 6,
    ageDays: 18,
  },
];
