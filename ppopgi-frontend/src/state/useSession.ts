// src/state/useSession.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BrowserProvider, JsonRpcSigner } from "ethers";

type Connector = "injected" | "walletconnect" | "metamask_injected" | null;

type SessionState = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;

  connector: Connector;

  // WalletConnect runtime object (NOT persisted)
  wcProvider: any | null;

  set: (s: Partial<SessionState>) => void;
  clear: () => void;
};

export const useSession = create(
  persist<SessionState>(
    (set, get) => ({
      provider: null,
      signer: null,
      account: null,
      chainId: null,

      connector: null,
      wcProvider: null,

      set: (s) => set(s),

      clear: () => {
        try {
          get().wcProvider?.disconnect?.();
        } catch {}

        set({
          provider: null,
          signer: null,
          account: null,
          chainId: null,
          connector: null,
          wcProvider: null,
        });
      },
    }),
    {
      name: "ppopgi-session",
      partialize: (s) => ({
        // persist only identity + connector choice
        account: s.account,
        chainId: s.chainId,
        connector: s.connector,
      }),
    }
  )
);