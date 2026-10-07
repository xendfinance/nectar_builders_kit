import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { setAccessToken } from "@/api/client";
import { api } from "@/api/endpoints";
import { getErrorMessage, isApiError } from "@/api/errors";
import { ERROR_CODES } from "@/api/types";
import type { NonceResponse, VerifyResponse } from "@/api/types";
import { API_MODE } from "@/config";
import type { DemoWalletId } from "@/lib/demoWallets";
import { buildSiweMessage } from "@/lib/siwe";
import { connectInjectedWallet, createDemoSigner } from "@/lib/wallet";
import type { WalletSigner } from "@/lib/wallet";

import { getInitialAttribution, storeLinkBuilderId } from "./attribution";
import type { Attribution } from "./attribution";

const ATTRIBUTION_REJECTIONS: string[] = [ERROR_CODES.UNKNOWN_BUILDER, ERROR_CODES.BUILDER_FROZEN];

interface WalletContextValue {
  signer?: WalletSigner;
  session?: VerifyResponse;
  attribution: Attribution;
  /** Set when sign-in fell back to no attribution because the builder was rejected. */
  attributionNotice?: string;
  isSigningIn: boolean;
  error?: string;
  connectDemo: (id: DemoWalletId) => void;
  connectBrowserWallet: () => Promise<void>;
  disconnect: () => void;
  signIn: () => Promise<void>;
  signOut: () => void;
  /** Changing attribution ends the session: attribution is fixed when the nonce is issued. */
  setAttribution: (attribution: Attribution) => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [signer, setSigner] = useState<WalletSigner | undefined>(() =>
    API_MODE === "mock" ? createDemoSigner("trader") : undefined
  );
  const [session, setSession] = useState<VerifyResponse>();
  const [attribution, setAttributionState] = useState<Attribution>(getInitialAttribution);
  const [attributionNotice, setAttributionNotice] = useState<string>();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string>();

  const signOut = useCallback(() => {
    setAccessToken(undefined);
    setSession(undefined);
    setAttributionNotice(undefined);
    // Authed queries are keyed by token, so the old session's data can never be shown for a new one.
    queryClient.removeQueries({ queryKey: ["authed"] });
  }, [queryClient]);

  const switchSigner = useCallback(
    (next: WalletSigner | undefined) => {
      signOut();
      setError(undefined);
      setSigner(next);
    },
    [signOut]
  );

  const connectDemo = useCallback((id: DemoWalletId) => switchSigner(createDemoSigner(id)), [switchSigner]);

  const connectBrowserWallet = useCallback(async () => {
    try {
      switchSigner(await connectInjectedWallet());
    } catch (connectError) {
      setError(getErrorMessage(connectError));
    }
  }, [switchSigner]);

  const disconnect = useCallback(() => switchSigner(undefined), [switchSigner]);

  const signIn = useCallback(async () => {
    if (!signer) {
      setError("Connect a wallet first.");
      return;
    }
    setIsSigningIn(true);
    setError(undefined);
    setAttributionNotice(undefined);

    try {
      // 1. Challenge, attributed to the builder. A rejected builder must never lock the trader out.
      let challenge: NonceResponse;
      try {
        challenge = await api.auth.nonce({ address: signer.address, builderId: attribution.builderId }, "headerWallet");
      } catch (nonceError) {
        if (
          attribution.builderId === undefined ||
          !isApiError(nonceError) ||
          !ATTRIBUTION_REJECTIONS.includes(nonceError.code)
        ) {
          throw nonceError;
        }
        setAttributionNotice(`${nonceError.message} (${nonceError.code}). Signed in without builder attribution.`);
        if (attribution.source === "link") {
          storeLinkBuilderId(undefined);
        }
        challenge = await api.auth.nonce({ address: signer.address }, "headerWallet");
      }

      // 2. The wallet signs the EIP-4361 message built from the challenge.
      const message = buildSiweMessage(challenge, signer.address);
      const signature = await signer.signMessage(message);

      // 3. The backend verifies it and returns a Bearer token.
      const verified = await api.auth.verify({ message, signature }, "headerWallet");
      setAccessToken(verified.accessToken);
      setSession(verified);
    } catch (signInError) {
      setError(getErrorMessage(signInError));
    } finally {
      setIsSigningIn(false);
    }
  }, [signer, attribution]);

  const setAttribution = useCallback(
    (next: Attribution) => {
      signOut();
      setAttributionState(next);
    },
    [signOut]
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      signer,
      session,
      attribution,
      attributionNotice,
      isSigningIn,
      error,
      connectDemo,
      connectBrowserWallet,
      disconnect,
      signIn,
      signOut,
      setAttribution,
    }),
    [
      signer,
      session,
      attribution,
      attributionNotice,
      isSigningIn,
      error,
      connectDemo,
      connectBrowserWallet,
      disconnect,
      signIn,
      signOut,
      setAttribution,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider");
  }
  return context;
}
