// src/components/RaffleCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { formatUnits } from "ethers";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;

  // Optional: used for Big Prizes podium ribbons
  ribbon?: "gold" | "silver" | "bronze";
};

function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

function formatEndsIn(deadlineSeconds: string, nowMs: number) {
  const n = Number(deadlineSeconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown";

  const deadlineMs = n * 1000;
  const diffMs = deadlineMs - nowMs;

  if (diffMs <= 0) return "Ended";

  const totalSec = Math.floor(diffMs / 1000);

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad2 = (x: number) => String(x).padStart(2, "0");
  const d = days > 0 ? `${days}d ` : "";
  return `${d}${hours}h ${minutes}m ${pad2(seconds)}s`;
}

function statusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

export function RaffleCard({ raffle, onOpen, ribbon }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const shareUrl = useMemo(() => {
    const u = new URL(window.location.href);
    u.search = "";
    u.searchParams.set("raffle", raffle.id);
    u.hash = "";
    return u.toString();
  }, [raffle.id]);

  async function onShareCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg("Link copied.");
    } catch {
      window.prompt("Copy this link:", shareUrl);
      setCopyMsg("Copy the link.");
    }

    window.setTimeout(() => setCopyMsg(null), 1100);
  }

  // ── derive display status (show ONE status, not two) ──
  const deadlineMs = useMemo(() => {
    const n = Number(raffle.deadline);
    return Number.isFinite(n) ? n * 1000 : 0;
  }, [raffle.deadline]);

  const deadlinePassed = deadlineMs > 0 ? nowMs >= deadlineMs : false;

  const displayStatus = useMemo(() => {
    // If indexer still says OPEN but deadline passed: communicate what users expect.
    if (raffle.status === "OPEN" && deadlinePassed) return "Finalizing";
    return statusLabel(raffle.status);
  }, [raffle.status, deadlinePassed]);

  const timeLine = useMemo(() => {
    // If settled/canceled: time is not the key. Use “Ended”.
    if (raffle.status === "COMPLETED" || raffle.status === "CANCELED") return "Ended";
    if (raffle.status === "DRAWING") return "In progress";
    // OPEN / FUNDING_PENDING: show countdown
    return formatEndsIn(raffle.deadline, nowMs);
  }, [raffle.status, raffle.deadline, nowMs]);

  const soldLine = useMemo(() => {
    const sold = raffle.sold ?? "0";
    const max = raffle.maxTickets ?? "0";
    const maxPart = max !== "0" ? ` / ${max}` : "";
    return `${sold}${maxPart}`;
  }, [raffle.sold, raffle.maxTickets]);

  const minLine = useMemo(() => {
    // your subgraph item may not include minTickets on list — if missing, hide quietly
    const anyRaffle = raffle as any;
    const min = anyRaffle?.minTickets;
    if (!min) return null;
    return String(min);
  }, [raffle]);

  // ── styles (ticket-like, pinker, smaller, rectangular) ──
  const card: React.CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: 420, // ✅ ticket width (prevents huge full-width cards)
    borderRadius: 18,
    padding: 14,
    cursor: "pointer",
    userSelect: "none",

    // ✅ more pink + more opacity
    background:
      "linear-gradient(135deg, rgba(246,182,200,0.44), rgba(203,183,246,0.24) 55%, rgba(255,216,154,0.18))",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
    backdropFilter: "blur(12px)",

    // ✅ subtle “ticket paper” texture
    overflow: "hidden",
  };

  const tearLine: React.CSSProperties = {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 54,
    height: 1,
    background:
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.55), rgba(255,255,255,0.55) 6px, rgba(255,255,255,0) 6px, rgba(255,255,255,0) 12px)",
    opacity: 0.7,
    pointerEvents: "none",
  };

  const notchBase: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 20,
    height: 20,
    borderRadius: 999,
    background: "rgba(255,255,255,0.20)", // “cutout” feel but still transparent
    border: "1px solid rgba(255,255,255,0.45)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.05)",
    pointerEvents: "none",
  };

  const leftNotch: React.CSSProperties = { ...notchBase, left: -10 };
  const rightNotch: React.CSSProperties = { ...notchBase, right: -10 };

  const ribbonWrap: React.CSSProperties = {
    position: "absolute",
    top: 10,
    left: 10,
    pointerEvents: "none",
  };

  const ribbonStyle = (kind: "gold" | "silver" | "bronze"): React.CSSProperties => {
    const bg =
      kind === "gold"
        ? "linear-gradient(135deg, rgba(255,216,154,0.95), rgba(255,216,154,0.55))"
        : kind === "silver"
        ? "linear-gradient(135deg, rgba(230,234,242,0.92), rgba(230,234,242,0.55))"
        : "linear-gradient(135deg, rgba(246,182,200,0.90), rgba(246,182,200,0.50))";

    const text = kind === "silver" ? "#2B2B33" : "#2B2B33";

    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      borderRadius: 999,
      background: bg,
      border: "1px solid rgba(255,255,255,0.70)",
      color: text,
      fontWeight: 900,
      fontSize: 11,
      letterSpacing: 0.3,
      boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
    };
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  };

  const title: React.CSSProperties = {
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 1.2,
    color: "#2B2B33",
    textAlign: "left",
    paddingRight: 6,
  };

  const chips: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexShrink: 0,
  };

  const statusChip: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    color: "#2B2B33",
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(255,255,255,0.65)",
    backdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
  };

  const shareBtn: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    color: "#2B2B33",
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(255,255,255,0.65)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const bodyGrid: React.CSSProperties = {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "1.25fr 1fr", // prize bigger left, info stack right
    gap: 10,
    alignItems: "stretch",
  };

  const prizeBox: React.CSSProperties = {
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.22)",
    border: "1px solid rgba(255,255,255,0.45)",
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
    color: "#2B2B33",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  };

  const bigValue: React.CSSProperties = {
    marginTop: 6,
    fontSize: 24,
    fontWeight: 1000 as any,
    color: "#2B2B33",
    lineHeight: 1.05,
  };

  const bigSub: React.CSSProperties = {
    marginTop: 2,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
    color: "#2B2B33",
  };

  const rightStack: React.CSSProperties = {
    display: "grid",
    gap: 8,
  };

  const miniBox: React.CSSProperties = {
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.20)",
    border: "1px solid rgba(255,255,255,0.40)",
  };

  const miniValue: React.CSSProperties = {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 900,
    color: "#2B2B33",
  };

  const footer: React.CSSProperties = {
    marginTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
    color: "#2B2B33",
  };

  const footerLeft: React.CSSProperties = {
    display: "grid",
    gap: 4,
    fontSize: 12,
    opacity: 0.92,
  };

  const footerRight: React.CSSProperties = {
    textAlign: "right",
    fontSize: 12,
    opacity: 0.92,
    whiteSpace: "nowrap",
  };

  const copyToast: React.CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 800,
    color: "#2B2B33",
    opacity: 0.95,
  };

  return (
    <div
      style={card}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(raffle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(raffle.id);
      }}
      title="Open raffle"
    >
      {/* Ticket notches */}
      <div style={leftNotch} />
      <div style={rightNotch} />

      {/* Podium ribbon (optional) */}
      {ribbon && (
        <div style={ribbonWrap}>
          <div style={ribbonStyle(ribbon)}>{ribbon.toUpperCase()}</div>
        </div>
      )}

      <div style={topRow}>
        <div style={title}>{raffle.name}</div>

        <div style={chips}>
          <div style={statusChip}>{displayStatus}</div>
          <button style={shareBtn} onClick={onShareCopy} title="Copy raffle link">
            Share link
          </button>
        </div>
      </div>

      <div style={bodyGrid}>
        {/* Prize big */}
        <div style={prizeBox}>
          <div style={label}>Prize</div>
          <div style={bigValue}>{fmtUsdc(raffle.winningPot)} USDC</div>
          <div style={bigSub}>Winner gets this amount</div>
        </div>

        {/* Small facts */}
        <div style={rightStack}>
          <div style={miniBox}>
            <div style={label}>Ticket</div>
            <div style={miniValue}>{fmtUsdc(raffle.ticketPrice)} USDC</div>
          </div>

          <div style={miniBox}>
            <div style={label}>Fee</div>
            <div style={miniValue}>{raffle.protocolFeePercent}%</div>
          </div>
        </div>
      </div>

      <div style={tearLine} />

      <div style={footer}>
        <div style={footerLeft}>
          <div>
            <span style={label}>Status</span>{" "}
            <span style={{ fontWeight: 900 }}>{displayStatus}</span>
          </div>
          <div>
            <span style={label}>Ends</span>{" "}
            <span style={{ fontWeight: 900 }}>{timeLine}</span>
          </div>
        </div>

        <div style={footerRight}>
          <div>
            <span style={label}>Tickets</span>{" "}
            <span style={{ fontWeight: 900 }}>{soldLine}</span>
          </div>

          {minLine && (
            <div>
              <span style={label}>Min</span>{" "}
              <span style={{ fontWeight: 900 }}>{minLine}</span>
            </div>
          )}
        </div>
      </div>

      {copyMsg && <div style={copyToast}>{copyMsg}</div>}
    </div>
  );
}