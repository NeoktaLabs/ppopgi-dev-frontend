import { create } from "zustand";
import type { BrowserProvider, JsonRpcSigner } from "ethers";

type Connector = "injected" | "walletconnect" | "metamask_injected" | "metamask_qr" | null;

type SessionState = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;

  connector: Connector;

  // existing WalletConnect
  wcProvider: any | null;

  // MetaMask SDK (QR/deeplink) session handles
  mmSdk: any | null;
  mmEip1193: any | null;

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

  mmSdk: null,
  mmEip1193: null,

  set: (s) => set(s),

  clear: () => {
    // WalletConnect disconnect
    try {
      get().wcProvider?.disconnect?.();
    } catch {}

    // MetaMask SDK disconnect (best effort)
    try {
      get().mmEip1193?.disconnect?.();
    } catch {}
    try {
      get().mmSdk?.disconnect?.();
    } catch {}

    set({
      provider: null,
      signer: null,
      account: null,
      chainId: null,
      connector: null,
      wcProvider: null,
      mmSdk: null,
      mmEip1193: null,
    });
  },
}));