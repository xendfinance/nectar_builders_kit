import { formatUnits, parseUnits } from "viem";

/** On-chain USD amounts carry 30 decimals (GMX/Nectar convention). */
export const USD_DECIMALS = 30;

const BPS_DENOMINATOR = 10_000n;

/** "1000.5" → 1000.5 × 1e30. Throws on malformed input. */
export function parseUsd(value: string): bigint {
  return parseUnits(value, USD_DECIMALS);
}

/** Lossy conversion for display and charts only. Never feed the result back into a payload. */
export function scaledToNumber(raw: string | bigint, decimals = USD_DECIMALS): number {
  return Number(formatUnits(typeof raw === "bigint" ? raw : BigInt(raw), decimals));
}

/** A JS number (e.g. an oracle price) → integer scaled by 10^decimals. Exact to 12 decimal places. */
export function numberToScaled(value: number, decimals = USD_DECIMALS): bigint {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Cannot scale ${value}`);
  }
  return parseUnits(value.toFixed(12), decimals);
}

export function applyBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / BPS_DENOMINATOR;
}

/** Exact, half-up rounded decimal string, e.g. 12345 × 1e28 → "123.45". Used for the spec's fee strings. */
export function formatScaled(raw: bigint, fractionDigits: number, decimals = USD_DECIMALS): string {
  if (raw < 0n) {
    return `-${formatScaled(-raw, fractionDigits, decimals)}`;
  }
  const unit = 10n ** BigInt(decimals - fractionDigits);
  const rounded = (raw + unit / 2n) / unit;
  if (fractionDigits === 0) {
    return rounded.toString();
  }
  const digits = rounded.toString().padStart(fractionDigits + 1, "0");
  return `${digits.slice(0, -fractionDigits)}.${digits.slice(-fractionDigits)}`;
}

export function isUnsignedIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}
