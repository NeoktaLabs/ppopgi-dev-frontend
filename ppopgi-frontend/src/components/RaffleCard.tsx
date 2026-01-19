// src/components/RaffleCard.tsx
import React from "react";
import type { RaffleListItem } from "../indexer/subgraph";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;
};

function formatDeadline(seconds: string) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  return new Date(n * 1000).toLocaleString();
}

export function RaffleCard({ raffle, onOpen }: Props) {
  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 12,
    cursor: "pointer",
  };

  return (
    <div
      key={raffle.id}
      style={cardStyle}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(raffle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(raffle.id);
      }}
      title="Open raffle"
    >
      <div style={{ fontWeight: 800 }}>{raffle.name}</div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        Win: {raffle.winningPot} USDC • Ticket: {raffle.ticketPrice} USDC
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