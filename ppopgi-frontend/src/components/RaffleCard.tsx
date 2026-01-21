// src/components/RaffleCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { formatUnits } from "ethers";
import "./raffleCard.css";

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
  if (!Number.isFinite(n) || n <= 0) return "Time unknown";

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

function statusTone(s: string) {
  if (s === "OPEN") return "open";
  if (s === "DRAWING") return "drawing";
  if (s === "COMPLETED") return "settled";
  if (s === "CANCELED") return "canceled";
  if (s === "FUNDING_PENDING") return "funding";
  return "unknown";
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
    setShareOpen(false);
  }

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

    if (raffle.status === "OPEN") {
      return "Deadline passed — finalization is pending.";
    }
    if (raffle.status === "DRAWING") {
      return "Winner selection is in progress.";
    }
    return null;
  }, [deadlinePassed, raffle.status]);

  const tone = statusTone(raffle.status);
  const max = raffle.maxTickets !== "0" ? raffle.maxTickets : null;

  return (
    <div
      className={`pp-ticket pp-ticket--${tone}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(raffle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(raffle.id);
      }}
      title="Open raffle"
    >
      {/* Top row */}
      <div className="pp-ticket__top">
        <div className="pp-ticket__titleWrap">
          <div className="pp-ticket__title">{raffle.name}</div>
          <div className={`pp-stamp pp-stamp--${tone}`} aria-label={`Status: ${displayStatus}`}>
            {displayStatus}
          </div>
        </div>

        {/* Share toggle (must NOT open modal) */}
        <button
          className="pp-pillBtn"
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

      {/* Main facts */}
      <div className="pp-ticket__facts">
        <div className="pp-fact">
          <div className="pp-fact__label">Prize</div>
          <div className="pp-fact__value">{fmtUsdc(raffle.winningPot)} USDC</div>
        </div>

        <div className="pp-fact">
          <div className="pp-fact__label">Ticket</div>
          <div className="pp-fact__value">{fmtUsdc(raffle.ticketPrice)} USDC</div>
        </div>

        <div className="pp-fact">
          <div className="pp-fact__label">Joined</div>
          <div className="pp-fact__value">
            {raffle.sold}
            {max ? ` / ${max}` : ""}
          </div>
        </div>

        <div className="pp-fact">
          <div className="pp-fact__label">Time</div>
          <div className="pp-fact__value">{formatEndsIn(raffle.deadline, nowMs)}</div>
        </div>
      </div>

      {/* small hint when deadline passed */}
      {statusHint && <div className="pp-hint">{statusHint}</div>}

      {/* Tear line */}
      <div className="pp-tear" aria-hidden="true" />

      {/* Footer */}
      <div className="pp-ticket__footer">
        <div className="pp-footerLine">
          <span className="pp-muted">Ppopgi fee</span>
          <span className="pp-strong">{raffle.protocolFeePercent}%</span>
        </div>

        <div className="pp-footerHint">
          Link format: <span className="pp-mono">?raffle=0x…</span>
        </div>
      </div>

      {/* Share panel */}
      {shareOpen && (
        <div
          className="pp-sharePanel"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          role="group"
          aria-label="Share raffle"
        >
          <div className="pp-shareHeader">
            <div className="pp-muted">Share this raffle</div>

            <button
              className="pp-pillBtn"
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

          <div className="pp-shareRow">
            <button
              className="pp-pillBtn"
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
              className="pp-pillBtn"
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
              className="pp-pillBtn"
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
              className="pp-pillBtn"
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
              className="pp-pillBtn"
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

          {copyMsg && <div className="pp-shareMsg">{copyMsg}</div>}
        </div>
      )}
    </div>
  );
}