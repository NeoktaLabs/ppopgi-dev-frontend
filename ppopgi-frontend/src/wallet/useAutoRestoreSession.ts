// src/wallet/useAutoRestoreSession.ts
import { useEffect } from "react";
import { useSession } from "../state/useSession";
import { connectInjected, connectWalletConnect } from "./connect";
import { connectMetaMaskInjected } from "./metamask";

let started = false;

export function useAutoRestoreSession() {
  useEffect(() => {
    if (started) return;
    started = true;

    const s = useSession.getState();
    if (!s.connector) return;

    (async () => {
      try {
        if (s.connector === "metamask_injected") {
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
          // ✅ Silent restore: do NOT show QR on refresh
          const r = await connectWalletConnect({ showQrModal: false });
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
        // If restore fails, clear local session so we don’t loop
        useSession.getState().clear();
      }
    })();
  }, []);
}