// src/state/useSession.ts
import { create } from "zustand";
import type { BrowserProvider, JsonRpcSigner } from "ethers";

type Connector = "injected" | "walletconnect" | "metamask_injected" | null;

type SessionState = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;

  connector: Connector;

  wcProvider: any | null;

  set: (s: Partial<SessionState>) => void;
  clear: () => void;
};

export const useSession = create<SessionState>((set, get) => ({
  provider: null,
  signer: null,
  account: null,
  chainId: null,

  connector: null,
  wcProvider: null,

  set: (s) => set(s),

  clear: () => {
    // WalletConnect disconnect (best effort)
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
}));