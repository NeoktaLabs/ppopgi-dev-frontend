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

function buildShareUrl(raffleId: string) {
  const url = new URL(window.location.href);

  // ✅ Keep ONLY raffle=0x... in the URL
  url.search = "";
  url.hash = "";
  url.searchParams.set("raffle", raffleId);

  return url.toString();
}

export function RaffleCard({ raffle, onOpen }: Props) {
  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 12,
    cursor: "pointer",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  };

  async function onShare(e: React.MouseEvent) {
    e.stopPropagation();

    const url = buildShareUrl(raffle.id);

    // ✅ Share sheet is fine, it DOES NOT affect the URL
    // (title/text are metadata, not appended to the URL)
    try {
      if (navigator.share) {
        await navigator.share({
          title: raffle.name,
          text: "Join this raffle on Ppopgi",
          url,
        });
        return;
      }
    } catch {
      // user canceled share sheet -> ignore
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

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
      <div style={topRow}>
        <div style={{ fontWeight: 800 }}>{raffle.name}</div>

        <button
          onClick={onShare}
          style={{
            border: "1px solid rgba(0,0,0,0.15)",
            background: "rgba(255,255,255,0.65)",
            borderRadius: 10,
            padding: "6px 8px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
          }}
          title="Share raffle"
        >
          Share
        </button>
      </div>

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