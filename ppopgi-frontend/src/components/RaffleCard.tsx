// src/components/RaffleCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { formatUnits } from "ethers";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;
};

function fmtUsdc(raw: string) {
  try {
    // USDC uses 6 decimals
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

// ✅ Live countdown: "Ends in 2d 3h 10m 05s"
function formatEndsIn(deadlineSeconds: string, nowMs: number) {
  const n = Number(deadlineSeconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";

  const deadlineMs = n * 1000;
  const diffMs = deadlineMs - nowMs;

  if (diffMs <= 0) return "Ended";

  const totalSec = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad2 = (x: number) => String(x).padStart(2, "0");

  // Show days only when >0, but always show h/m/s
  const d = days > 0 ? `${days}d ` : "";
  return `Ends in ${d}${hours}h ${minutes}m ${pad2(seconds)}s`;
}

function statusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

export function RaffleCard({ raffle, onOpen }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // ✅ ticking clock (updates the countdown live)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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

  // ---- transparency helpers ----
  const deadlineMs = useMemo(() => {
    const n = Number(raffle.deadline);
    return Number.isFinite(n) ? n * 1000 : 0;
  }, [raffle.deadline]);

  const deadlinePassed = deadlineMs > 0 ? nowMs >= deadlineMs : false;

  // If deadline passed but indexer still says OPEN => show Finalizing instead of confusing "Open/Ended"
  const displayStatus = useMemo(() => {
    if (raffle.status === "OPEN" && deadlinePassed) return "Finalizing…";
    return statusLabel(raffle.status);
  }, [raffle.status, deadlinePassed]);

  const statusHint = useMemo(() => {
    if (!deadlinePassed) return null;

    // Deadline passed: explain what users should expect
    if (raffle.status === "OPEN") {
      return "Deadline passed — finalization is pending on-chain.";
    }
    if (raffle.status === "DRAWING") {
      return "Winner selection is in progress on-chain.";
    }
    return null;
  }, [deadlinePassed, raffle.status]);

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
        Win: {fmtUsdc(raffle.winningPot)} USDC • Ticket: {fmtUsdc(raffle.ticketPrice)} USDC
      </div>

      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        Joined: {raffle.sold}
        {raffle.maxTickets !== "0" ? ` / ${raffle.maxTickets}` : ""}
      </div>

      {/* ✅ live countdown */}
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        {formatEndsIn(raffle.deadline, nowMs)}
      </div>

      {/* ✅ clearer status */}
      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
        Status: <b>{displayStatus}</b>
      </div>

      {/* ✅ small “why” hint when deadline passed but UI might feel confusing */}
      {statusHint && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
          {statusHint}
        </div>
      )}

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