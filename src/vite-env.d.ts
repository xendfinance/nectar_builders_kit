/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: string;
  readonly VITE_NECTAR_API_URL?: string;
  readonly VITE_BUILDER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** EIP-1193 provider injected by browser wallets (MetaMask, Rabby, ...). */
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  };
}
