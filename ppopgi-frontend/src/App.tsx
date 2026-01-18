// src/App.tsx
import React, { useState } from "react";
import { useSession } from "./state/useSession";
import { SignInModal } from "./components/SignInModal";
import { ETHERLINK_MAINNET } from "./chain/etherlink";
import { useAutoRestoreSession } from "./wallet/useAutoRestoreSession";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function App() {
  // ✅ restores previous sign-in after refresh (best effort)
  useAutoRestoreSession();

  const account = useSession((s) => s.account);
  const chainId = useSession((s) => s.chainId);
  const clear = useSession((s) => s.clear);

  const [open, setOpen] = useState(false);

  const wrongPlace = !!account && chainId !== ETHERLINK_MAINNET.chainId;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>Ppopgi</b>

        <div style={{ display: "flex", gap: 10 }}>
          <button>Explore</button>
          <button>Create</button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button>Cashier</button>

          {!account ? (
            <button onClick={() => setOpen(true)}>Sign in</button>
          ) : (
            <>
              <span>Your account: {short(account)}</span>
              <button onClick={clear}>Sign out</button>
            </>
          )}
        </div>
      </div>

      {wrongPlace && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 10 }}>
          This raffle booth runs on <b>{ETHERLINK_MAINNET.chainName}</b>. Please switch “where you
          play” to continue.
        </div>
      )}

      <SignInModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}