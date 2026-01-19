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
  const [shareOpen, setShareOpen] = useState(false);
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

      // auto-close after short feedback
      window.setTimeout(() => {
        setCopyMsg(null);
        setShareOpen(false);
      }, 900);
    } catch {
      window.prompt("Copy this link:", shareUrl);
      setCopyMsg("Copy the link.");

      window.setTimeout(() => {
        setCopyMsg(null);
        setShareOpen(false);
      }, 1200);
    }
  }

  function openShare(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");

    // auto-close immediately after opening share
    setShareOpen(false);
  }

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
    alignItems: "baseline",
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

  const sharePanel: React.CSSProperties = {
    marginTop: 10,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.60)",
    borderRadius: 12,
    padding: 10,
  };

  const shareRow: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };

  const subtle: React.CSSProperties = { fontSize: 12, opacity: 0.8 };

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

        {/* Share toggle (must NOT open modal) */}
        <button
          style={shareBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShareOpen((v) => !v);
          }}
          aria-expanded={shareOpen}
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

      {/* Share panel */}
      {shareOpen && (
        <div
          style={sharePanel}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          role="group"
          aria-label="Share raffle"
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={subtle}>Share this raffle</div>

            <button
              style={shareBtn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShareOpen(false);
              }}
              title="Close share"
            >
              Close
            </button>
          </div>

          <div style={{ marginTop: 10, ...shareRow }}>
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

          {copyMsg && <div style={{ marginTop: 8, ...subtle }}>{copyMsg}</div>}

          <div style={{ marginTop: 8, ...subtle }}>
            Link format is always: <span style={{ fontWeight: 700 }}>?raffle=0x…</span>
          </div>
        </div>
      )}
    </div>
  );
}