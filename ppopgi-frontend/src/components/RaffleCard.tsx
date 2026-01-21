// src/components/RaffleCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { formatUnits } from "ethers";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;

  // Optional: used for Big Prizes podium ribbons
  ribbon?: "gold" | "silver" | "bronze";

  /**
   * Optional: if you later want "real" quick entry (write tx from the card),
   * pass a handler here. If omitted, the Enter button simply opens the modal.
   */
  onQuickEnter?: (raffleId: string, qty: number) => void;
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
  return `${d}${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

function statusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

function ribbonText(r: "gold" | "silver" | "bronze") {
  if (r === "gold") return "GOLD";
  if (r === "silver") return "SILVER";
  return "BRONZE";
}

export function RaffleCard({ raffle, onOpen, ribbon, onQuickEnter }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);

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

  // ── derive ONE display status ──
  const deadlineMs = useMemo(() => {
    const n = Number(raffle.deadline);
    return Number.isFinite(n) ? n * 1000 : 0;
  }, [raffle.deadline]);

  const deadlinePassed = deadlineMs > 0 ? nowMs >= deadlineMs : false;

  const displayStatus = useMemo(() => {
    // If indexer still says OPEN but deadline passed: user-meaningful state
    if (raffle.status === "OPEN" && deadlinePassed) return "Finalizing";
    return statusLabel(raffle.status);
  }, [raffle.status, deadlinePassed]);

  const isOpen = displayStatus === "Open";

  const endsLine = useMemo(() => {
    if (displayStatus === "Settled" || displayStatus === "Canceled") return "Ended";
    if (displayStatus === "Drawing" || displayStatus === "Finalizing") return "In progress";
    return formatEndsIn(raffle.deadline, nowMs);
  }, [displayStatus, raffle.deadline, nowMs]);

  const soldNum = useMemo(() => {
    const n = Number(raffle.sold || "0");
    return Number.isFinite(n) ? n : 0;
  }, [raffle.sold]);

  const maxNum = useMemo(() => {
    const n = Number(raffle.maxTickets || "0");
    return Number.isFinite(n) ? n : 0;
  }, [raffle.maxTickets]);

  const soldLine = useMemo(() => {
    if (maxNum > 0) return `${soldNum} / ${maxNum}`;
    return `${soldNum}`;
  }, [soldNum, maxNum]);

  const soldPct = useMemo(() => {
    if (!maxNum) return null;
    const p = Math.max(0, Math.min(100, Math.round((soldNum / maxNum) * 100)));
    return p;
  }, [soldNum, maxNum]);

  const minLine = useMemo(() => {
    const anyRaffle = raffle as any;
    const min = anyRaffle?.minTickets;
    if (!min) return null;
    return String(min);
  }, [raffle]);

  // Quick entry helpers
  const canQuickEnter = isOpen;
  const inc = () => setQty((q) => Math.min(1000, q + 1));
  const dec = () => setQty((q) => Math.max(1, q - 1));

  const onPressEnter = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onQuickEnter) onQuickEnter(raffle.id, qty);
    else onOpen(raffle.id);
  };

  // ───────── styles (vertical ticket) ─────────

  const card: React.CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: 340, // ✅ vertical ticket width
    borderRadius: 22,
    padding: 16,
    cursor: "pointer",
    userSelect: "none",
    overflow: "hidden",

    // ✅ stronger pink, less “washed out”
    background:
      "linear-gradient(180deg, rgba(255,214,230,0.86), rgba(255,214,230,0.58) 40%, rgba(255,232,243,0.64))",
    border: "1px solid rgba(255,255,255,0.70)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.14)",
    backdropFilter: "blur(14px)",

    transition: "transform 140ms ease, box-shadow 140ms ease",
  };

  const hoverLift: React.CSSProperties = {
    transform: "translateY(-4px)",
    boxShadow: "0 20px 44px rgba(0,0,0,0.18)",
  };

  // notches
  const notch: React.CSSProperties = {
    position: "absolute",
    top: "52%",
    transform: "translateY(-50%)",
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.14)",
    pointerEvents: "none",
  };

  const tearLine: React.CSSProperties = {
    marginTop: 14,
    height: 1,
    background:
      "repeating-linear-gradient(90deg, rgba(180,70,120,0.55), rgba(180,70,120,0.55) 7px, rgba(180,70,120,0) 7px, rgba(180,70,120,0) 14px)",
    opacity: 0.75,
    pointerEvents: "none",
  };

  // top row chips
  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  };

  const rightChips: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  };

  const statusChip: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.25,
    color: isOpen ? "#0B4A24" : "#5C2A3E",
    background: isOpen ? "rgba(145, 247, 184, 0.92)" : "rgba(255,255,255,0.72)",
    border: isOpen ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(0,0,0,0.08)",
    whiteSpace: "nowrap",
  };

  const shareIconBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(0,0,0,0.08)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  };

  // ribbon moved AWAY from title (no overlap)
  const ribbonPill: React.CSSProperties = {
    marginTop: 10,
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.35,
    color: "#2B2B33",
    background:
      ribbon === "gold"
        ? "linear-gradient(135deg, rgba(255,216,154,0.95), rgba(255,216,154,0.62))"
        : ribbon === "silver"
        ? "linear-gradient(135deg, rgba(230,234,242,0.92), rgba(230,234,242,0.62))"
        : "linear-gradient(135deg, rgba(246,182,200,0.92), rgba(246,182,200,0.60))",
    border: "1px solid rgba(255,255,255,0.70)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  // text colors (less boring than pure black)
  const ink: React.CSSProperties = { color: "#5C1F3B" };
  const inkStrong: React.CSSProperties = { color: "#4A0F2B" };

  const titleWrap: React.CSSProperties = {
    marginTop: 10,
    textAlign: "center",
  };

  const smallKicker: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
    ...ink,
  };

  const titleText: React.CSSProperties = {
    marginTop: 4,
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: 0.1,
    lineHeight: 1.15,
    ...inkStrong,
  };

  const prizeKicker: React.CSSProperties = {
    marginTop: 14,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    opacity: 0.9,
    ...ink,
    textAlign: "center",
  };

  const prizeValue: React.CSSProperties = {
    marginTop: 8,
    fontSize: 34,
    fontWeight: 1000 as any,
    lineHeight: 1.0,
    letterSpacing: 0.2,
    textAlign: "center",
    color: "#4A0F2B",
    textShadow: "0 1px 0 rgba(255,255,255,0.35)",
  };

  const midGrid: React.CSSProperties = {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  const mini: React.CSSProperties = {
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.42)", // ✅ less transparent
    border: "1px solid rgba(0,0,0,0.06)",
  };

  const miniLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.25,
    opacity: 0.85,
    ...ink,
  };

  const miniValue: React.CSSProperties = {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 950,
    ...inkStrong,
  };

  const progressWrap: React.CSSProperties = {
    marginTop: 12,
  };

  const progressBar: React.CSSProperties = {
    height: 10,
    borderRadius: 999,
    background: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  };

  const progressFill: React.CSSProperties = {
    height: "100%",
    width: `${soldPct ?? 0}%`,
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(246,182,200,0.95), rgba(203,183,246,0.85))",
  };

  const progressMeta: React.CSSProperties = {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    fontWeight: 900,
    ...ink,
  };

  const endsRow: React.CSSProperties = {
    marginTop: 14,
    paddingTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  };

  const endsText: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 950,
    color: "#7B1B4D",
    letterSpacing: 0.3,
  };

  const quickBar: React.CSSProperties = {
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    background: "rgba(255,255,255,0.46)",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  const stepper: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const stepBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(0,0,0,0.08)",
    cursor: "pointer",
    fontWeight: 950,
    ...inkStrong,
  };

  const qtyPill: React.CSSProperties = {
    minWidth: 34,
    textAlign: "center",
    fontWeight: 950,
    ...inkStrong,
  };

  const enterBtn: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(145, 247, 184, 0.92)",
    border: "1px solid rgba(0,0,0,0.06)",
    cursor: "pointer",
    fontWeight: 950,
    color: "#0B4A24",
    whiteSpace: "nowrap",
  };

  const copyToast: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    fontWeight: 900,
    ...ink,
    opacity: 0.95,
    textAlign: "center",
  };

  // simple hover without CSS file dependency
  const [isHover, setIsHover] = useState(false);

  return (
    <div
      style={{ ...card, ...(isHover ? hoverLift : null) }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(raffle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(raffle.id);
      }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      title="Open raffle"
    >
      {/* Ticket notches */}
      <div style={{ ...notch, left: -9 }} />
      <div style={{ ...notch, right: -9 }} />

      <div style={topRow}>
        <div style={rightChips}>
          <div style={statusChip}>{displayStatus.toUpperCase()}</div>
        </div>

        <button style={shareIconBtn} onClick={onShareCopy} title="Copy raffle link" aria-label="Copy link">
          {/* share icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 8a3 3 0 1 0-2.82-4H15a3 3 0 0 0 .18 1L8.9 9.1a3 3 0 0 0-1.9-.7 3 3 0 1 0 2.82 4l6.2 3.1A3 3 0 1 0 17 13a3 3 0 0 0-.18 1l-6.2-3.1A3 3 0 0 0 9 10c0-.2 0-.4-.1-.6l6.3-4.1A3 3 0 0 0 18 8Z"
              fill="#7B1B4D"
              opacity="0.9"
            />
          </svg>
        </button>
      </div>

      {/* Ribbon now sits below header, not blocking the title */}
      {ribbon && <div style={ribbonPill}>{ribbonText(ribbon)}</div>}

      <div style={titleWrap}>
        <div style={smallKicker}>Ppopgi</div>
        <div style={titleText}>{raffle.name}</div>
      </div>

      <div style={prizeKicker}>Winner gets</div>
      <div style={prizeValue}>{fmtUsdc(raffle.winningPot)} USDC</div>

      <div style={tearLine} />

      <div style={midGrid}>
        <div style={mini}>
          <div style={miniLabel}>Ticket price</div>
          <div style={miniValue}>{fmtUsdc(raffle.ticketPrice)} USDC</div>
        </div>

        <div style={mini}>
          <div style={miniLabel}>Fee</div>
          <div style={miniValue}>{raffle.protocolFeePercent}%</div>
        </div>
      </div>

      <div style={progressWrap}>
        {soldPct !== null ? (
          <>
            <div style={progressBar}>
              <div style={progressFill} />
            </div>
            <div style={progressMeta}>
              <div>Min: {minLine ?? "—"}</div>
              <div>{soldPct}% sold</div>
            </div>
          </>
        ) : (
          <div style={progressMeta}>
            <div>Min: {minLine ?? "—"}</div>
            <div>Tickets: {soldLine}</div>
          </div>
        )}
      </div>

      <div style={endsRow}>
        <div style={endsText}>ENDS IN: {endsLine}</div>
        {/* tiny clock */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
            stroke="#7B1B4D"
            strokeWidth="2"
            opacity="0.8"
          />
          <path
            d="M12 7v6l4 2"
            stroke="#7B1B4D"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        </svg>
      </div>

      {/* Quick entry (Open only) */}
      {canQuickEnter && (
        <div
          style={quickBar}
          onClick={(e) => {
            // prevent bar click opening the modal
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={stepper}>
            <button style={stepBtn} onClick={(e) => (e.preventDefault(), e.stopPropagation(), dec())} aria-label="Decrease">
              −
            </button>
            <div style={qtyPill}>{qty}</div>
            <button style={stepBtn} onClick={(e) => (e.preventDefault(), e.stopPropagation(), inc())} aria-label="Increase">
              +
            </button>
          </div>

          <button style={enterBtn} onClick={onPressEnter} title="Enter this raffle">
            Enter
          </button>
        </div>
      )}

      {copyMsg && <div style={copyToast}>{copyMsg}</div>}
    </div>
  );
}