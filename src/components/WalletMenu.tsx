import { useEffect, useRef, useState } from "react";

import { API_MODE } from "@/config";
import { useWallet } from "@/context/WalletContext";
import { DEMO_WALLETS } from "@/lib/demoWallets";
import { shortAddress } from "@/lib/format";
import { hasInjectedWallet } from "@/lib/wallet";

import { ApiBadge } from "./ApiBadge";
import { Button } from "./Button";
import { Spinner } from "./states";

/** Wallet choice and the three-step SIWE sign-in (nonce → sign → verify). */
export function WalletMenu() {
  const { signer, session, isSigningIn, error, connectDemo, connectBrowserWallet, disconnect, signIn, signOut } =
    useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative flex items-center gap-2">
      {signer && !session && (
        <Button variant="primary" size="sm" onClick={signIn} disabled={isSigningIn}>
          {isSigningIn && <Spinner className="h-3 w-3" />}
          Sign in
        </Button>
      )}
      <Button size="sm" className="whitespace-nowrap" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
        <span className={session ? "h-2 w-2 rounded-full bg-long" : "h-2 w-2 rounded-full bg-ink-faint"} />
        {signer ? shortAddress(signer.address) : "Connect wallet"}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-9 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-surface-line bg-surface-raised p-3 shadow-xl">
          {signer && (
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-ink-muted">{signer.label}</span>
              <span className="break-all font-mono text-ink">{signer.address}</span>
              <span className={session ? "text-long" : "text-ink-faint"}>
                {session
                  ? `Signed in · session expires ${new Date(session.expiresAt).toLocaleString()}`
                  : "Not signed in"}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-short">{error}</p>}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Switch wallet</span>
            {API_MODE === "mock" &&
              Object.values(DEMO_WALLETS).map((wallet) => (
                <button
                  key={wallet.id}
                  type="button"
                  onClick={() => {
                    connectDemo(wallet.id);
                    setIsOpen(false);
                  }}
                  className="flex flex-col rounded-md px-2 py-1.5 text-left hover:bg-surface-card"
                >
                  <span className="text-sm text-ink">{wallet.label}</span>
                  <span className="text-xs text-ink-faint">{wallet.description}</span>
                </button>
              ))}
            <button
              type="button"
              disabled={!hasInjectedWallet()}
              onClick={async () => {
                await connectBrowserWallet();
                setIsOpen(false);
              }}
              className="flex flex-col rounded-md px-2 py-1.5 text-left hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-sm text-ink">Browser wallet</span>
              <span className="text-xs text-ink-faint">
                {hasInjectedWallet() ? "MetaMask or any EIP-1193 wallet." : "No browser wallet detected."}
              </span>
            </button>
          </div>

          <div className="flex gap-2">
            {session && (
              <Button size="sm" onClick={signOut}>
                Sign out
              </Button>
            )}
            {signer && (
              <Button size="sm" variant="ghost" onClick={disconnect}>
                Disconnect
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1 border-t border-surface-line pt-2">
            <span className="text-xs text-ink-faint">Sign-in calls</span>
            <ApiBadge endpoints={["auth.nonce", "auth.verify"]} source="headerWallet" />
          </div>
        </div>
      )}
    </div>
  );
}
