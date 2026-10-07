import { getAddress, isAddress, verifyTypedData } from "viem";

import type { AccountOrderItem, Eip712Payload, PrepareOrderResponse, SubmitOrderResponse } from "@/api/types";
import { ERROR_CODES } from "@/api/types";
import { CHAIN_ID, DEFAULT_SLIPPAGE_BPS } from "@/config";
import { isSignature, toTypedData } from "@/lib/eip712";
import { findMarketByKey } from "@/lib/markets";
import { applyBps, formatScaled, isUnsignedIntegerString, numberToScaled, parseUsd } from "@/lib/units";

import { findBuilderById, queueExecution } from "../db";
import {
  EXECUTION_DELAY_MS,
  FEE_ACCRUING_STATUSES,
  MOCK_BASE_FEE_BPS,
  MOCK_MIN_ORDER_USD,
  MOCK_ORDER_RELAY,
  PREPARED_ORDER_TTL_MS,
  ZERO_ADDRESS,
} from "../fixtures";
import { HttpError, MOCK_ERROR_CODES, ok, readBody, requireSession } from "../http";
import type { RouteContext } from "../http";
import { randomHex, randomUuid } from "../random";
import type { Route } from "../router";

const MARKET_INCREASE = 2;

const ORDER_TYPES: Eip712Payload["types"] = {
  Order: [
    { name: "marketKey", type: "address" },
    { name: "collateralToken", type: "address" },
    { name: "sizeDeltaUsd", type: "uint256" },
    { name: "isLong", type: "bool" },
    { name: "orderType", type: "uint8" },
    { name: "acceptablePrice", type: "uint256" },
    { name: "uiFeeReceiver", type: "address" },
    { name: "baseFeeAmountUsd", type: "uint256" },
    { name: "builderFeeAmountUsd", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
};

function accountOrders({ db, params }: RouteContext) {
  const { account } = params;
  if (account === undefined || !isAddress(account, { strict: false })) {
    throw new HttpError(400, ERROR_CODES.INVALID_ADDRESS, "account must be a valid EVM address");
  }
  const orders: AccountOrderItem[] = db.accountOrders.get(account.toLowerCase()) ?? [];
  return ok(orders);
}

function prepareOrder(context: RouteContext) {
  const { db, now } = context;
  const session = requireSession(context);
  const body = readBody(context);

  const market = typeof body.marketKey === "string" ? findMarketByKey(body.marketKey) : undefined;
  if (!market) {
    throw new HttpError(400, ERROR_CODES.INVALID_MARKET, "Unknown marketKey");
  }

  const marketTokens = [market.indexToken.address, market.collateralToken.address].map((token) => token.toLowerCase());
  if (typeof body.collateralToken !== "string" || !marketTokens.includes(body.collateralToken.toLowerCase())) {
    throw new HttpError(400, ERROR_CODES.INVALID_MARKET, "collateralToken is not a token of this market");
  }

  if (!isUnsignedIntegerString(body.sizeDeltaUsd)) {
    throw new HttpError(400, ERROR_CODES.INVALID_SIZE, "sizeDeltaUsd must be USD × 1e30 as an integer string");
  }
  const sizeDeltaUsd = BigInt(body.sizeDeltaUsd);
  if (sizeDeltaUsd < parseUsd(String(MOCK_MIN_ORDER_USD))) {
    throw new HttpError(400, ERROR_CODES.INVALID_SIZE, `Minimum order size is $${MOCK_MIN_ORDER_USD}`);
  }

  if (typeof body.isLong !== "boolean") {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, "isLong must be a boolean");
  }
  const { isLong } = body;

  const orderType = body.orderType ?? MARKET_INCREASE;
  if (orderType !== MARKET_INCREASE) {
    throw new HttpError(400, ERROR_CODES.INVALID_ORDER_TYPE, "The mock supports MarketIncrease (orderType 2) only");
  }

  if (body.swapPath !== undefined && !(Array.isArray(body.swapPath) && body.swapPath.length === 0)) {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, "The mock does not support swapPath");
  }

  let acceptablePrice: bigint;
  if (body.acceptablePrice === undefined) {
    const mark = db.feed.priceAt(market.indexToken.symbol, now);
    const slippage = DEFAULT_SLIPPAGE_BPS / 10_000;
    acceptablePrice = numberToScaled(mark * (isLong ? 1 + slippage : 1 - slippage));
  } else if (isUnsignedIntegerString(body.acceptablePrice)) {
    acceptablePrice = BigInt(body.acceptablePrice);
  } else {
    throw new HttpError(
      400,
      MOCK_ERROR_CODES.INVALID_PARAMS,
      "acceptablePrice must be USD × 1e30 as an integer string"
    );
  }

  // Fees come from the session's builder, never from the request.
  const builder = session.builderId === null ? undefined : findBuilderById(db, session.builderId);
  const accruingBuilder = builder && FEE_ACCRUING_STATUSES.includes(builder.profile.status) ? builder : undefined;
  const builderFeeRateBps = accruingBuilder?.profile.feeRateBps ?? 0;
  const baseFee = applyBps(sizeDeltaUsd, MOCK_BASE_FEE_BPS);
  const builderFee = applyBps(sizeDeltaUsd, builderFeeRateBps);
  const uiFeeReceiver = accruingBuilder ? getAddress(accruingBuilder.profile.walletAddress) : ZERO_ADDRESS;

  const orderId = randomUuid(db.random);
  const expiresAtMs = now + PREPARED_ORDER_TTL_MS;

  const payload: Eip712Payload = {
    domain: { name: "Nectar Order Relay", version: "1", chainId: CHAIN_ID, verifyingContract: MOCK_ORDER_RELAY },
    types: ORDER_TYPES,
    message: {
      marketKey: getAddress(market.marketKey),
      collateralToken: getAddress(body.collateralToken),
      sizeDeltaUsd: sizeDeltaUsd.toString(),
      isLong,
      orderType: MARKET_INCREASE,
      acceptablePrice: acceptablePrice.toString(),
      uiFeeReceiver,
      baseFeeAmountUsd: baseFee.toString(),
      builderFeeAmountUsd: builderFee.toString(),
      nonce: BigInt(`0x${randomHex(db.random, 8)}`).toString(),
      expiry: Math.floor(expiresAtMs / 1000),
    },
  };

  const response: PrepareOrderResponse = {
    orderId,
    expiresAt: new Date(expiresAtMs).toISOString(),
    eip712Payload: payload,
    feeBreakdown: {
      baseFeeRateBps: MOCK_BASE_FEE_BPS,
      builderFeeRateBps,
      totalFeeRateBps: MOCK_BASE_FEE_BPS + builderFeeRateBps,
      baseFeeAmountUsd: formatScaled(baseFee, 2),
      builderFeeAmountUsd: formatScaled(builderFee, 2),
      totalFeeAmountUsd: formatScaled(baseFee + builderFee, 2),
      builderName: accruingBuilder?.profile.name ?? null,
      uiFeeReceiver,
    },
  };

  db.prepared.set(orderId, {
    orderId,
    account: session.address,
    builderId: accruingBuilder?.profile.builderId ?? null,
    market,
    isLong,
    orderType: MARKET_INCREASE,
    sizeDeltaUsd,
    acceptablePrice,
    baseFee,
    builderFee,
    payload,
    feeBreakdown: response.feeBreakdown,
    expiresAtMs,
    submitted: false,
  });
  return ok(response);
}

async function submitOrder(context: RouteContext) {
  const { db, now } = context;
  const session = requireSession(context);
  const body = readBody(context);
  if (typeof body.orderId !== "string" || typeof body.signature !== "string") {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, "orderId and signature are required strings");
  }

  const prepared = db.prepared.get(body.orderId);
  // Another account's order is reported as missing so order IDs leak nothing.
  if (!prepared || prepared.account.toLowerCase() !== session.address.toLowerCase()) {
    throw new HttpError(404, ERROR_CODES.ORDER_NOT_FOUND, "No prepared order with this ID for this session");
  }
  if (prepared.submitted) {
    throw new HttpError(409, ERROR_CODES.ORDER_ALREADY_SUBMITTED, "This order was already submitted");
  }
  if (prepared.expiresAtMs <= now) {
    throw new HttpError(410, ERROR_CODES.ORDER_EXPIRED, "The quote expired. Prepare the order again");
  }

  // Verified against the stored copy: a payload edited client-side (fees included) cannot produce a match.
  const { signature } = body;
  const isValid =
    isSignature(signature) &&
    (await verifyTypedData({
      address: getAddress(prepared.account),
      signature,
      ...toTypedData(prepared.payload),
    }).catch(() => false));
  if (!isValid) {
    throw new HttpError(
      400,
      ERROR_CODES.SIGNATURE_MISMATCH,
      "Signature does not match the prepared order. Sign eip712Payload exactly as returned"
    );
  }

  prepared.submitted = true;
  const txHash = `0x${randomHex(db.random, 32)}`;
  queueExecution(db, prepared, txHash, now, EXECUTION_DELAY_MS);

  const response: SubmitOrderResponse = {
    orderId: prepared.orderId,
    txHash,
    status: "submitted",
    submittedAt: new Date(now).toISOString(),
  };
  return ok(response, 202);
}

export const orderRoutes: Route[] = [
  { method: "GET", path: "/accounts/:account/orders", handler: accountOrders },
  { method: "POST", path: "/orders/prepare", handler: prepareOrder },
  { method: "POST", path: "/orders/submit", handler: submitOrder },
];
