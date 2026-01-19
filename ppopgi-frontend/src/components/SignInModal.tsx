import React, { useEffect } from "react";
import { ETHERLINK_MAINNET } from "../chain/etherlink";
import { useSession } from "../state/useSession";

import { ConnectEmbed, useActiveAccount, useActiveWalletChain, useDisconnect } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";

import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SignInModal({ open, onClose }: Props) {
  const setSession = useSession((s) => s.set);

  // thirdweb state (source of truth for connection)
  const account = useActiveAccount();
  const chain = useActiveWalletChain();
  const disconnect = useDisconnect();

  // keep your app session in sync for UI
  useEffect(() => {
    if (!open) return;
    if (!account?.address) return;

    setSession({
      account: account.address,
      chainId: chain?.id ?? null,
      connector: "thirdweb",
    });

    // close modal once connected
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };

  const card: React.CSSProperties = {
    width: "min(520px, 100%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.22)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
    padding: 18,
  };

  const closeBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
  };

  const note: React.CSSProperties = {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.85,
    color: "#2B2B33",
  };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "#2B2B33" }}>Sign in</h2>
          <button style={closeBtn} onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <p style={{ margin: "10px 0 0", color: "#2B2B33", lineHeight: 1.35 }}>
          Choose how you want to sign in. This raffle booth runs on <b>{ETHERLINK_MAINNET.chainName}</b>.
        </p>

        {/* thirdweb connect UI */}
        <div style={{ marginTop: 14 }}>
          <ConnectEmbed
            client={thirdwebClient}
            chain={ETHERLINK_CHAIN}
            wallets={[
              // MetaMask first
              createWallet("io.metamask"),
              // Then a broad connector that supports many wallets (QR included)
              createWallet("walletConnect"),
              // Then injected wallets (Brave, Coinbase extension, etc.)
              createWallet("injected"),
            ]}
          />
        </div>

        <div style={note}>Nothing happens automatically. You always confirm actions yourself.</div>

        {/* optional: allow disconnect from inside modal if you want */}
        <div style={{ marginTop: 10 }}>
          <button
            style={{
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.18)",
              borderRadius: 12,
              padding: "8px 10px",
              cursor: "pointer",
              color: "#2B2B33",
            }}
            onClick={() => disconnect()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}