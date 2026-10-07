import { createWalletClient, custom, getAddress } from "viem";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { Eip712Payload } from "@/api/types";

import { DEMO_WALLETS } from "./demoWallets";
import type { DemoWalletId } from "./demoWallets";
import { toTypedData } from "./eip712";

/** What the interface needs from a wallet: an address and two signing methods. */
export interface WalletSigner {
  kind: "demo" | "injected";
  label: string;
  address: Address;
  /** personal_sign, used for SIWE. */
  signMessage: (message: string) => Promise<Hex>;
  /** eth_signTypedData_v4, used for prepared orders. */
  signTypedData: (payload: Eip712Payload) => Promise<Hex>;
}

export function createDemoSigner(id: DemoWalletId): WalletSigner {
  const wallet = DEMO_WALLETS[id];
  const account = privateKeyToAccount(wallet.privateKey);

  return {
    kind: "demo",
    label: wallet.label,
    address: account.address,
    signMessage: (message) => account.signMessage({ message }),
    signTypedData: (payload) => account.signTypedData(toTypedData(payload)),
  };
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && window.ethereum !== undefined;
}

/** Connects MetaMask (or any EIP-1193 wallet). Needed for live mode, where the backend sees real wallets. */
export async function connectInjectedWallet(): Promise<WalletSigner> {
  const provider = window.ethereum;
  if (!provider) {
    throw new Error("No browser wallet found. Install MetaMask or another EIP-1193 wallet.");
  }

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const first = accounts[0];
  if (first === undefined) {
    throw new Error("The wallet returned no accounts.");
  }

  const address = getAddress(first);
  const client = createWalletClient({ account: address, transport: custom(provider) });

  return {
    kind: "injected",
    label: "Browser wallet",
    address,
    signMessage: (message) => client.signMessage({ account: address, message }),
    // Wallets reject typed data whose domain chainId differs from the active chain: switch to AssetChain testnet.
    signTypedData: (payload) => client.signTypedData({ account: address, ...toTypedData(payload) }),
  };
}
