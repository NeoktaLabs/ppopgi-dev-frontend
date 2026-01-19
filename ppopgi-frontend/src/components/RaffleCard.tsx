import React, { useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { Toast } from "./Toast";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;
};

function formatDeadline(seconds: string) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  return new Date(n * 1000).toLocaleString();
}

// IMPORTANT: Always share ONLY ?raffle=0x... (no text/title params)
function buildRaffleUrl(raffleId: string) {
  const u = new URL(window.location.href);
  u.search = `?raffle=${raffleId}`;
  return u.toString();
}

export function RaffleCard({ raffle, onOpen }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 12,
    cursor: "pointer",
    position: "relative",
  };

  const iconBtn: React.CSSProperties = {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.75)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1200);
  }

  async function onCopyLink(e: React.MouseEvent) {
    e.stopPropagation();

    const url = buildRaffleUrl(raffle.id);

    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      // fallback
      window.prompt("Copy this link:", url);
      showToast("Copy the link");
    }
  }

  return (
    <>
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
        {/* Share icon button */}
        <button
          type="button"
          onClick={onCopyLink}
          style={iconBtn}
          aria-label="Copy raffle link"
          title="Copy link"
        >
          <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>↗</span>
        </button>

        <div style={{ fontWeight: 800, paddingRight: 60 }}>{raffle.name}</div>

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

      <Toast text={toast} />
    </>
  );
}