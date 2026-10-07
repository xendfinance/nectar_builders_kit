import { getAddress, isAddress, verifyMessage } from "viem";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";

import type { AuthSessionResponse, NonceResponse, VerifyResponse } from "@/api/types";
import { ERROR_CODES } from "@/api/types";
import { CHAIN_ID, isValidBuilderId } from "@/config";
import { isSignature } from "@/lib/eip712";

import { findBuilderById } from "../db";
import { FEE_ACCRUING_STATUSES, NONCE_TTL_MS, SESSION_TTL_S } from "../fixtures";
import { HttpError, MOCK_ERROR_CODES, ok, readBody, requireSession } from "../http";
import type { RouteContext } from "../http";
import { randomAlphanumeric, randomHex } from "../random";
import type { Route } from "../router";

const SIWE_STATEMENT = "Sign in to Nectar";

function issueNonce({ db, request, now, siwe }: RouteContext) {
  const address = request.query.address;
  if (address === undefined || !isAddress(address, { strict: false })) {
    throw new HttpError(400, ERROR_CODES.INVALID_ADDRESS, "address must be a valid EVM address");
  }

  const builderId = request.query.builderId;
  let builder: ReturnType<typeof findBuilderById>;
  if (builderId !== undefined) {
    builder = isValidBuilderId(builderId) ? findBuilderById(db, builderId) : undefined;
    if (!builder) {
      throw new HttpError(404, ERROR_CODES.UNKNOWN_BUILDER, "Builder ID does not exist");
    }
    if (!FEE_ACCRUING_STATUSES.includes(builder.profile.status)) {
      throw new HttpError(
        403,
        ERROR_CODES.BUILDER_FROZEN,
        `Builder is ${builder.profile.status}; sign in without attribution`
      );
    }
  }

  const nonce = randomAlphanumeric(db.random, 17);
  const expiresAtMs = now + NONCE_TTL_MS;
  db.nonces.set(nonce, {
    nonce,
    address: address.toLowerCase(),
    builderId: builder?.profile.builderId ?? null,
    expiresAtMs,
    used: false,
  });

  const response: NonceResponse = {
    address: getAddress(address),
    nonce,
    expiresAt: new Date(expiresAtMs).toISOString(),
    domain: siwe.domain,
    uri: siwe.uri,
    statement: SIWE_STATEMENT,
    version: "1",
    chainId: CHAIN_ID,
    builderId: builder?.profile.builderId ?? null,
    builderName: builder?.profile.name ?? null,
  };
  return ok(response);
}

async function verify(context: RouteContext) {
  const { db, now, siwe } = context;
  const body = readBody(context);
  if (typeof body.message !== "string" || typeof body.signature !== "string") {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, "message and signature are required strings");
  }
  const { message, signature } = body;

  const parsed = parseSiweMessage(message);
  const record = parsed.nonce === undefined ? undefined : db.nonces.get(parsed.nonce);
  if (!record || record.used || record.expiresAtMs <= now) {
    throw new HttpError(401, MOCK_ERROR_CODES.INVALID_NONCE, "Nonce is unknown, already used or expired");
  }
  if (parsed.address === undefined || parsed.address.toLowerCase() !== record.address) {
    throw new HttpError(401, MOCK_ERROR_CODES.INVALID_NONCE, "Nonce was issued to a different address");
  }
  if (parsed.chainId !== CHAIN_ID) {
    throw new HttpError(400, MOCK_ERROR_CODES.INVALID_PARAMS, `Chain ID must be ${CHAIN_ID}`);
  }
  if (!validateSiweMessage({ message: parsed, domain: siwe.domain, nonce: record.nonce, time: new Date(now) })) {
    throw new HttpError(
      400,
      MOCK_ERROR_CODES.INVALID_PARAMS,
      "SIWE message does not match the challenge (domain, nonce or validity window)"
    );
  }

  const isValid =
    isSignature(signature) && (await verifyMessage({ address: parsed.address, message, signature }).catch(() => false));
  if (!isValid) {
    throw new HttpError(401, MOCK_ERROR_CODES.INVALID_SIGNATURE, "Signature does not match the address in the message");
  }
  record.used = true;

  const address = getAddress(parsed.address);
  const traderKey = address.toLowerCase();
  const existing = db.traders.get(traderKey);
  const trader = existing ?? { id: db.nextTraderId++, address, referralCode: null, isNew: false };
  db.traders.set(traderKey, trader);

  const token = `mock_${randomHex(db.random, 24)}`;
  const expiresAtMs = now + SESSION_TTL_S * 1000;
  db.sessions.set(token, { token, address, builderId: record.builderId, chainId: CHAIN_ID, expiresAtMs });

  const response: VerifyResponse = {
    accessToken: token,
    tokenType: "Bearer",
    expiresIn: SESSION_TTL_S,
    expiresAt: new Date(expiresAtMs).toISOString(),
    address,
    chainId: CHAIN_ID,
    trader: { ...trader, isNew: existing === undefined },
  };
  return ok(response);
}

function readSession(context: RouteContext) {
  const session = requireSession(context);
  const builder = session.builderId === null ? undefined : findBuilderById(context.db, session.builderId);
  const trader = context.db.traders.get(session.address.toLowerCase());
  if (!trader) {
    throw new HttpError(500, MOCK_ERROR_CODES.INTERNAL_ERROR, "Session has no trader record");
  }

  const response: AuthSessionResponse = {
    address: session.address,
    chainId: session.chainId,
    trader,
    builderId: builder?.profile.builderId ?? null,
    builderName: builder?.profile.name ?? null,
    builderFeeRateBps: builder?.profile.feeRateBps ?? null,
  };
  return ok(response);
}

export const authRoutes: Route[] = [
  { method: "GET", path: "/auth/nonce", handler: issueNonce },
  { method: "POST", path: "/auth/verify", handler: verify },
  { method: "GET", path: "/auth", handler: readSession },
];
