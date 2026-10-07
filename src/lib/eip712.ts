import { getAddress } from "viem";
import type { Hex, TypedDataDefinition } from "viem";

import type { Eip712Payload } from "@/api/types";

/**
 * The spec's `eip712Payload` carries `domain`, `types` and `message` but no `primaryType`, and sends uint values
 * as decimal strings. This converts it into the exact typed data that wallets sign and the backend verifies.
 * The payload itself is never modified: fees included, it must be signed exactly as issued.
 */

/** The struct no other struct references. The spec sends a single struct ("Order"), so that is the one. */
export function getPrimaryType(types: Eip712Payload["types"]): string {
  const structNames = Object.keys(types).filter((name) => name !== "EIP712Domain");
  const referenced = new Set(
    structNames.flatMap((name) => (types[name] ?? []).map((field) => field.type.replace(/\[\d*\]$/, "")))
  );
  const roots = structNames.filter((name) => !referenced.has(name));

  if (roots.length !== 1) {
    throw new Error(`Expected exactly one primary EIP-712 type, found: ${roots.join(", ") || "none"}`);
  }
  return roots[0] as string;
}

const INTEGER_TYPE = /^u?int(\d+)?$/;

export function toTypedData(payload: Eip712Payload): TypedDataDefinition {
  const primaryType = getPrimaryType(payload.types);
  const fields = payload.types[primaryType] ?? [];
  const source = payload.message as unknown as Record<string, unknown>;

  const message: Record<string, unknown> = {};
  for (const field of fields) {
    const value = source[field.name];
    if (value === undefined) {
      throw new Error(`EIP-712 message is missing field "${field.name}"`);
    }
    if (INTEGER_TYPE.test(field.type)) {
      message[field.name] = BigInt(value as string | number);
    } else if (field.type === "address") {
      // Checksum casing does not change the hash; normalising lets lower-case addresses from any backend through.
      message[field.name] = getAddress(value as string);
    } else {
      message[field.name] = value;
    }
  }

  // viem derives EIP712Domain from `domain` itself, so it must not appear in `types`.
  const types = Object.fromEntries(Object.entries(payload.types).filter(([name]) => name !== "EIP712Domain"));

  return {
    domain: { ...payload.domain, verifyingContract: getAddress(payload.domain.verifyingContract) },
    types,
    primaryType,
    message,
  } as unknown as TypedDataDefinition;
}

export function isSignature(value: unknown): value is Hex {
  return typeof value === "string" && /^0x[0-9a-fA-F]{130}$/.test(value);
}
