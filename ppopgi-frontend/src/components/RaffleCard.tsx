// src/components/RaffleCard.tsx
import React, { useState } from "react";
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

function buildRaffleLink(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("raffle", id);
  return url.toString();
}

export function RaffleCard({ raffle, onOpen }: Props) {
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 12,
    cursor: "pointer",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  };

  const shareBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.75)",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  };

  async function onShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setShareMsg(null);

    const link = buildRaffleLink(raffle.id);
    const title = raffle.name || "Ppopgi raffle";
    const text = `Join this raffle: ${title}`;

    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title, text, url: link });
        setShareMsg("Shared.");
        window.setTimeout(() => setShareMsg(null), 1500);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setShareMsg("Link copied.");
        window.setTimeout(() => setShareMsg(null), 1500);
        return;
      }

      // last resort
      window.prompt("Copy this link:", link);
    } catch (err: any) {
      const m = String(err?.message || "");
      if (m.toLowerCase().includes("abort")) {
        // user closed share sheet
        return;
      }
      setShareMsg("Could not share. Try again.");
      window.setTimeout(() => setShareMsg(null), 2000);
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

        <button style={shareBtn} onClick={onShare} title="Share this raffle">
          Share
        </button>
      </div>

      {shareMsg && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{shareMsg}</div>
      )}

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