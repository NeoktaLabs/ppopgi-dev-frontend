// src/components/SafetyProofModal.tsx
import React, { useMemo } from "react";
import type { RaffleDetails } from "../hooks/useRaffleDetails";

type Props = {
  open: boolean;
  onClose: () => void;
  raffle: RaffleDetails;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function safeBigInt(x: string) {
  try {
    return BigInt(x);
  } catch {
    return 0n;
  }
}

export function SafetyProofModal({ open, onClose, raffle }: Props) {
  const breakdown = useMemo(() => {
    const revenue = safeBigInt(raffle.ticketRevenue);
    const pot = safeBigInt(raffle.winningPot);
    const pct = safeBigInt(raffle.protocolFeePercent);

    // fee = revenue * pct / 100
    const fee = (revenue * pct) / 100n;

    // creator share "so far" = revenue - pot - fee (can be negative early; clamp at 0 for display)
    let creatorSoFar = revenue - pot - fee;
    if (creatorSoFar < 0n) creatorSoFar = 0n;

    return { revenue, pot, pct, fee, creatorSoFar };
  }, [raffle]);

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 11000,
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

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Safety info</h2>
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
          These values come from the network and can’t be changed by the app.
        </div>

        <div style={section}>
          <div style={{ fontWeight: 800 }}>Who gets what</div>

          <div style={row}>
            <div style={label}>Winner gets</div>
            <div style={value}>{raffle.winningPot} USDC</div>
          </div>

          <div style={row}>
            <div style={label}>Ppopgi fee</div>
            <div style={value}>
              {breakdown.fee.toString()} USDC ({raffle.protocolFeePercent}%)
            </div>
          </div>

          <div style={row}>
            <div style={label}>Fee receiver</div>
            <div style={value}>{short(raffle.feeRecipient)}</div>
          </div>

          <div style={row}>
            <div style={label}>Creator gets (so far)</div>
            <div style={value}>{breakdown.creatorSoFar.toString()} USDC</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            “So far” means based on tickets sold up to now.
          </div>
        </div>

        <div style={section}>
          <div style={{ fontWeight: 800 }}>How the draw works</div>

          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, opacity: 0.9 }}>
            When time ends (or tickets sell out), anyone can start the draw.
            A randomness service is asked for a random number.
            A winner is shown only after the randomness result arrives.
          </div>

          <div style={row}>
            <div style={label}>Randomness service</div>
            <div style={value}>{short(raffle.entropyProvider)}</div>
          </div>

          {raffle.status === "DRAWING" && (
            <>
              <div style={row}>
                <div style={label}>Request id</div>
                <div style={value}>{raffle.entropyRequestId}</div>
              </div>
              <div style={row}>
                <div style={label}>Provider used</div>
                <div style={value}>{short(raffle.selectedProvider)}</div>
              </div>
            </>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            If the randomness result never comes back, there is an on-chain recovery path.
          </div>
        </div>

        <div style={section}>
          <div style={{ fontWeight: 800 }}>What the app cannot do</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.45 }}>
            <li>The app cannot choose the winner.</li>
            <li>The app cannot change rules after the raffle is created.</li>
            <li>The app cannot take prizes or refunds once they are owed.</li>
            <li>Anyone can start the draw — it does not depend on one operator.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}