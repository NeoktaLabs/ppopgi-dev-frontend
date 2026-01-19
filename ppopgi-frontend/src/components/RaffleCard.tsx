// src/components/RaffleCard.tsx
import React, { useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { getRaffleShareUrl } from "../utils/share";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;
};

function formatDeadline(seconds: string) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  return new Date(n * 1000).toLocaleString();
}

function enc(s: string) {
  return encodeURIComponent(s);
}

export function RaffleCard({ raffle, onOpen }: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => getRaffleShareUrl(raffle.id), [raffle.id]);
  const shareText = useMemo(() => `Join this raffle: ${raffle.name}`, [raffle.name]);

  const xHref = useMemo(() => {
    // X uses intent/tweet (or intent/post). Keep it simple.
    return `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`;
  }, [shareText, shareUrl]);

  const fbHref = useMemo(() => {
    // Facebook share supports URL only (quote is sometimes ignored).
    return `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`;
  }, [shareUrl]);

  const tgHref = useMemo(() => {
    return `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`;
  }, [shareUrl, shareText]);

  const waHref = useMemo(() => {
    return `https://wa.me/?text=${enc(`${shareText} ${shareUrl}`)}`;
  }, [shareText, shareUrl]);

  async function onCopy(e: React.MouseEvent) {
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback for older browsers
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {
        // ignore
      }
    }
  }

  function onShareClick(e: React.MouseEvent) {
    // prevent card click opening modal when clicking share buttons
    e.stopPropagation();
  }

  const cardStyle: React.CSSProperties = {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 12,
    cursor: "pointer",
  };

  const shareRow: React.CSSProperties = {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };

  const pill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.65)",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    color: "#2B2B33",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  const pillDisabled: React.CSSProperties = {
    ...pill,
    opacity: 0.75,
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

      {/* Share row */}
      <div style={shareRow} onClick={onShareClick}>
        <button style={copied ? pillDisabled : pill} onClick={onCopy} type="button">
          {copied ? "Copied!" : "Copy link"}
        </button>

        <a style={pill} href={xHref} target="_blank" rel="noreferrer">
          X
        </a>

        <a style={pill} href={fbHref} target="_blank" rel="noreferrer">
          Facebook
        </a>

        <a style={pill} href={tgHref} target="_blank" rel="noreferrer">
          Telegram
        </a>

        <a style={pill} href={waHref} target="_blank" rel="noreferrer">
          WhatsApp
        </a>
      </div>
    </div>
  );
}