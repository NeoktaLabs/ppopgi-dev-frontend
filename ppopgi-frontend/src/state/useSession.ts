import { create } from "zustand";
import { persist } from "zustand/middleware";

type Connector = "thirdweb" | null;

type SessionState = {
  account: string | null;
  chainId: number | null;
  connector: Connector;

  set: (s: Partial<SessionState>) => void;
  clear: () => void;
};

export const useSession = create(
  persist<SessionState>(
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
      partialize: (s) => ({
        account: s.account,
        chainId: s.chainId,
        connector: s.connector,
      }),
    }
  )
);