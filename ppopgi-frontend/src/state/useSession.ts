// src/state/useSession.ts  (update your store to remember connector type + wc provider for proper disconnect)
import { create } from "zustand";
import type { BrowserProvider, JsonRpcSigner } from "ethers";

type Connector = "injected" | "walletconnect" | null;

type SessionState = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;
  connector: Connector;
  wcProvider: any | null; // WalletConnect EthereumProvider (only set when using QR)
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
    const wc = get().wcProvider;
    // For QR sign-in, disconnect the session explicitly (no surprises)
    try {
      wc?.disconnect?.();
    } catch {
      // ignore
    }
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