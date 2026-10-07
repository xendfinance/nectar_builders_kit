import type { Address, Hex } from "viem";

export type DemoWalletId = "trader" | "builder";

export interface DemoWallet {
  id: DemoWalletId;
  label: string;
  description: string;
  address: Address;
  privateKey: Hex;
}

/**
 * Two well-known local test keys (Hardhat/Anvil accounts #0 and #1). They are public: never send funds to them.
 * They let the demo produce real SIWE and EIP-712 signatures, which the mock backend verifies with viem exactly as
 * a real backend would. `demoWallets.spec.ts` checks each address matches its key.
 */
export const DEMO_WALLETS: Record<DemoWalletId, DemoWallet> = {
  trader: {
    id: "trader",
    label: "Demo trader",
    description: "A trader using your interface. Its sessions are attributed to your builder ID.",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  builder: {
    id: "builder",
    label: "Demo builder (PerpDesk)",
    description: "The fee-receiver wallet of the demo builder. Signs in to the builder dashboard.",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
};
