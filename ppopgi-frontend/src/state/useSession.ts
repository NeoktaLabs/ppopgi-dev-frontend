// src/state/useSession.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Connector = "thirdweb" | null;

export type SessionState = {
  account: string | null;
  chainId: number | null;
  connector: Connector;

  set: (s: Partial<SessionState>) => void;
  clear: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      account: null,
      chainId: null,
      connector: null,

      set: (s) => set(s),

      clear: () =>
        set({
          account: null,
          chainId: null,
          connector: null,
        }),
    }),
    {
      name: "ppopgi-session",
      // ✅ Return only a subset (Zustand persists partial state)
      partialize: (s) => ({
        account: s.account,
        chainId: s.chainId,
        connector: s.connector,
      }),
    }
  )
);