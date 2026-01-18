// src/components/CreateRaffleModal.tsx
import React from "react";
import { ETHERLINK_MAINNET } from "../chain/etherlink";
import { useFactoryConfig } from "../hooks/useFactoryConfig";

type Props = {
  open: boolean;
  onClose: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function CreateRaffleModal({ open, onClose }: Props) {
  const { data, loading, note } = useFactoryConfig(open);

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const card: React.CSSProperties = {
    width: "min(560px, 100%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.22)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
    padding: 18,
    color: "#2B2B33",
  };

  const section: React.CSSProperties = {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 6,
  };

  const label: React.CSSProperties = { opacity: 0.85 };
  const value: React.CSSProperties = { fontWeight: 700 };

  const btn: React.CSSProperties = {
    width: "100%",
    marginTop: 12,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.24)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: "not-allowed",
    opacity: 0.6,
    color: "#2B2B33",
    fontWeight: 800,
    textAlign: "center",
  };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Create</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Create a raffle</div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "1px solid rgba(255,255,255,0.5)",
              background: "rgba(255,255,255,0.25)",
              borderRadius: 12,
              padding: "8px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          This raffle booth runs on <b>{ETHERLINK_MAINNET.chainName}</b>.
        </div>

        {loading && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            Loading create settings…
          </div>
        )}

        {note && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            {note}
          </div>
        )}

        <div style={section}>
          <div style={{ fontWeight: 800 }}>Create settings (live)</div>

          <div style={row}>
            <div style={label}>Ppopgi fee</div>
            <div style={value}>{data ? `${data.protocolFeePercent}%` : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>Fee receiver</div>
            <div style={value}>{data ? short(data.feeRecipient) : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>Coins used</div>
            <div style={value}>{data ? `Coins (USDC) • ${short(data.usdc)}` : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>Randomness service</div>
            <div style={value}>{data ? short(data.entropyProvider) : "—"}</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            These settings are set on the network and can’t be changed by the app.
          </div>
        </div>

        <div style={btn} aria-disabled="true">
          Create raffle (coming soon)
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          Nothing happens automatically. You always confirm actions yourself.
        </div>
      </div>
    </div>
  );
}