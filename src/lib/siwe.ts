import { getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";

import type { NonceResponse } from "@/api/types";

/** Builds the EIP-4361 message for a /auth/nonce challenge. The wallet signs this exact string. */
export function buildSiweMessage(challenge: NonceResponse, address: string, issuedAt = new Date()): string {
  if (challenge.version !== "1") {
    throw new Error(`Unsupported SIWE version "${challenge.version}"`);
  }

  return createSiweMessage({
    domain: challenge.domain,
    address: getAddress(address),
    statement: challenge.statement || "Sign in to Nectar",
    uri: challenge.uri,
    version: "1",
    chainId: challenge.chainId,
    nonce: challenge.nonce,
    issuedAt,
    expirationTime: new Date(challenge.expiresAt),
  });
}
