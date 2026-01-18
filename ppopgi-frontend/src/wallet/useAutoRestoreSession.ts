// src/wallet/useAutoRestoreSession.ts
import { useEffect } from "react";
import { useSession } from "../state/useSession";
import { connectInjected, connectWalletConnect } from "./connect";
import { connectMetaMaskInjected } from "./metamask";

/**
 * Restores a previous sign-in on refresh (best effort).
 * If restore fails, we clear the session and the user can sign in again.
 */
export function useAutoRestoreSession() {
  useEffect(() => {
    const s = useSession.getState();

    if (!s.connector) return;

    (async () => {
      try {
        if (s.connector === "metamask_injected") {
          // MetaMask injected only
          const r = await connectMetaMaskInjected();
          useSession.getState().set({
            provider: r.provider,
            signer: r.signer,
            account: r.account,
            chainId: r.chainId,
            connector: "metamask_injected",
            wcProvider: null,
          });
          return;
        }

        if (s.connector === "injected") {
          const r = await connectInjected();
          useSession.getState().set({
            provider: r.provider,
            signer: r.signer,
            account: r.account,
            chainId: r.chainId,
            connector: "injected",
            wcProvider: null,
          });
          return;
        }

        if (s.connector === "walletconnect") {
          const r = await connectWalletConnect();
          useSession.getState().set({
            provider: r.provider,
            signer: r.signer,
            account: r.account,
            chainId: r.chainId,
            connector: "walletconnect",
            wcProvider: r.wcProvider,
          });
          return;
        }
      } catch {
        useSession.getState().clear();
      }
    })();
  }, []);
}