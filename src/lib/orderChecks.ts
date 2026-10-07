import type { PrepareOrderResponse } from "@/api/types";
import { CHAIN_ID } from "@/config";

import { parseUsd } from "./units";

/** What the trader asked for, before the backend prepared it. */
export interface OrderIntent {
  marketKey: string;
  collateralToken: string;
  sizeDeltaUsd: bigint;
  isLong: boolean;
  orderType: number;
}

/** Breakdown strings are rounded to cents; allow strictly less than one cent of difference. */
const ONE_CENT = parseUsd("0.01");

function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function matchesCents(scaled: string, display: string) {
  const difference = BigInt(scaled) - parseUsd(display);
  return (difference < 0n ? -difference : difference) < ONE_CENT;
}

/**
 * Checks a prepared order before the wallet is asked to sign it. The signature authorises exactly what is in
 * `eip712Payload.message`, so the interface must confirm the message is the order the trader asked for and that the
 * fees in it are the fees the trader was shown. Returns human-readable problems; an empty list means safe to sign.
 */
export function checkPreparedOrder(intent: OrderIntent, prepared: PrepareOrderResponse, nowMs = Date.now()): string[] {
  const { domain, message } = prepared.eip712Payload;
  const fees = prepared.feeBreakdown;
  const problems: string[] = [];

  if (domain.chainId !== CHAIN_ID) problems.push(`Signing domain is chain ${domain.chainId}, expected ${CHAIN_ID}.`);
  if (!sameAddress(message.marketKey, intent.marketKey)) problems.push("Market differs from the one selected.");
  if (!sameAddress(message.collateralToken, intent.collateralToken)) problems.push("Collateral token differs.");
  if (BigInt(message.sizeDeltaUsd) !== intent.sizeDeltaUsd) problems.push("Order size differs from the size entered.");
  if (message.isLong !== intent.isLong) problems.push("Direction (long/short) differs.");
  if (message.orderType !== intent.orderType) problems.push("Order type differs.");
  if (!matchesCents(message.baseFeeAmountUsd, fees.baseFeeAmountUsd))
    problems.push("Signed base fee differs from the fee shown.");
  if (!matchesCents(message.builderFeeAmountUsd, fees.builderFeeAmountUsd)) {
    problems.push("Signed builder fee differs from the fee shown.");
  }
  const signedTotal = BigInt(message.baseFeeAmountUsd) + BigInt(message.builderFeeAmountUsd);
  if (!matchesCents(signedTotal.toString(), fees.totalFeeAmountUsd))
    problems.push("Signed total fee differs from the total shown.");
  if (!sameAddress(message.uiFeeReceiver, fees.uiFeeReceiver))
    problems.push("Fee receiver differs from the one shown.");
  if (Date.parse(prepared.expiresAt) <= nowMs) problems.push("The quote has expired.");

  return problems;
}
