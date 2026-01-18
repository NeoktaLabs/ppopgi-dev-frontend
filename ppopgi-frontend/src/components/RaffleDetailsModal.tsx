// src/components/RaffleDetailsModal.tsx
import React, { useMemo, useState } from "react";
import { useRaffleDetails } from "../hooks/useRaffleDetails";
import { SafetyProofModal } from "./SafetyProofModal";

type Props = {
  open: boolean;
  raffleId: string | null;
  onClose: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function statusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

function formatTime(seconds: string) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  return new Date(n * 1000).toLocaleString();
}

export function RaffleDetailsModal({ open, raffleId, onClose }: Props) {
  const { data, loading, note } = useRaffleDetails(open ? raffleId : null);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const canShowWinner = useMemo(() => data?.status === "COMPLETED", [data?.status]);

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

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Raffle</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{data?.name ?? "Loading…"}</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => data && setSafetyOpen(true)}
              disabled={!data}
              style={{
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.25)",
                borderRadius: 12,
                padding: "8px 10px",
                cursor: data ? "pointer" : "not-allowed",
                opacity: data ? 1 : 0.55,
              }}
            >
              Safety info
            </button>

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
        </div>

        {loading && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            Loading live details…
          </div>
        )}

        {note && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            {note}
          </div>
        )}

        {data && (
          <>
            <div style={section}>
              <div style={{ fontWeight: 800 }}>Status</div>
              <div style={row}>
                <div style={label}>State</div>
                <div style={value}>{statusLabel(data.status)}</div>
              </div>
              <div style={row}>
                <div style={label}>Ends at</div>
                <div style={value}>{formatTime(data.deadline)}</div>
              </div>
              <div style={row}>
                <div style={label}>Joined</div>
                <div style={value}>
                  {data.sold}
                  {data.maxTickets !== "0" ? ` / ${data.maxTickets}` : ""}
                </div>
              </div>
              {data.paused && (
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                  This raffle is paused right now.
                </div>
              )}
            </div>

            <div style={section}>
              <div style={{ fontWeight: 800 }}>Costs</div>

              <div style={row}>
                <div style={label}>Ticket</div>
                <div style={value}>{data.ticketPrice} USDC</div>
              </div>

              <div style={row}>
                <div style={label}>Win</div>
                <div style={value}>{data.winningPot} USDC</div>
              </div>

              <div style={row}>
                <div style={label}>Ppopgi fee</div>
                <div style={value}>{data.protocolFeePercent}%</div>
              </div>

              <div style={row}>
                <div style={label}>Fee receiver</div>
                <div style={value}>{short(data.feeRecipient)}</div>
              </div>
            </div>

            {canShowWinner ? (
              <div style={section}>
                <div style={{ fontWeight: 800 }}>Winner</div>
                <div style={row}>
                  <div style={label}>Winning account</div>
                  <div style={value}>{short(data.winner)}</div>
                </div>
                <div style={row}>
                  <div style={label}>Winning ticket</div>
                  <div style={value}>{data.winningTicketIndex}</div>
                </div>
                <div style={row}>
                  <div style={label}>Prize</div>
                  <div style={value}>{data.winningPot} USDC</div>
                </div>
              </div>
            ) : (
              <div style={section}>
                <div style={{ fontWeight: 800 }}>Winner</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                  The winner is shown only after the raffle is settled.
                </div>
              </div>
            )}
          </>
        )}

        {data && (
          <SafetyProofModal
            open={safetyOpen}
            onClose={() => setSafetyOpen(false)}
            raffle={data}
          />
        )}
      </div>
    </div>
  );
}