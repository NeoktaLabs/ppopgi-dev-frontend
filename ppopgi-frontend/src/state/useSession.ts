import { create } from "zustand";
import type { BrowserProvider, JsonRpcSigner } from "ethers";

type Session = {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;
  set: (p: Partial<Session>) => void;
  clear: () => void;
};

export const useSession = create<Session>((set) => ({
  provider: null,
  signer: null,
  account: null,
  chainId: null,
  set: (p) => set(p),
  clear: () => set({ provider: null, signer: null, account: null, chainId: null }),
}));