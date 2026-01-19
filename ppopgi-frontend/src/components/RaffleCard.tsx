// src/components/RaffleCard.tsx
import React, { useMemo, useState } from "react";
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
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    const u = new URL(window.location.href);
    u.search = `?raffle=${raffle.id}`;
    return u.toString();
  }, [raffle.id]);

  const shareText = useMemo(() => {
    const name = raffle?.name ? `Join this raffle: ${raffle.name}` : "Join this raffle";
    return name;
  }, [raffle?.name]);

  const shareLinks = useMemo(() => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(shareText);

    return {
      x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    };
  }, [shareUrl, shareText]);

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg("Link copied.");
      window.setTimeout(() => setCopyMsg(null), 1200);
    } catch {
      window.prompt("Copy this link:", shareUrl);
      setCopyMsg("Copy the link.");
      window.setTimeout(() => setCopyMsg(null), 1200);
    }
  }

  function openShare(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 12,
    cursor: "pointer",
  };

  const shareBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.75)",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
  };

  const shareRow: React.CSSProperties = {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 800 }}>{raffle.name}</div>

        {/* Share actions (don’t open modal) */}
        <button
          style={shareBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCopyLink();
          }}
          title="Copy raffle link"
        >
          Share
        </button>
      </div>

      {copyMsg && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
          {copyMsg}
        </div>
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

      {/* Optional: quick share destinations (also don’t open modal) */}
      <div style={shareRow}>
        <button
          style={shareBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCopyLink();
          }}
          title="Copy link"
        >
          Copy link
        </button>

        <button
          style={shareBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openShare(shareLinks.x);
          }}
          title="Share on X"
        >
          X
        </button>

        <button
          style={shareBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openShare(shareLinks.facebook);
          }}
          title="Share on Facebook"
        >
          Facebook
        </button>

        <button
          style={shareBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openShare(shareLinks.telegram);
          }}
          title="Share on Telegram"
        >
          Telegram
        </button>

        <button
          style={shareBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openShare(shareLinks.whatsapp);
          }}
          title="Share on WhatsApp"
        >
          WhatsApp
        </button>
      </div>
    </div>
  );
}