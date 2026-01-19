// src/components/RaffleCard.tsx
import React from "react";
import { formatUnits } from "ethers";
import type { RaffleListItem, RaffleStatus } from "../indexer/subgraph";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;
};

function formatDeadline(seconds: string) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  return new Date(n * 1000).toLocaleString();
}

function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

function statusLabel(s: RaffleStatus) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

export function RaffleCard({ raffle, onOpen }: Props) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 12,
        cursor: "pointer",
      }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(raffle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(raffle.id);
      }}
      title="Open raffle"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>{raffle.name}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{statusLabel(raffle.status)}</div>
      </div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        Win: {fmtUsdc(raffle.winningPot)} USDC • Ticket: {fmtUsdc(raffle.ticketPrice)} USDC
      </div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        Joined: {raffle.sold}
        {raffle.maxTickets !== "0" ? ` / ${raffle.maxTickets}` : ""}
      </div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        Ends at: {formatDeadline(raffle.deadline)}
      </div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        Ppopgi fee: {raffle.protocolFeePercent}%
      </div>
    </div>
  );
}