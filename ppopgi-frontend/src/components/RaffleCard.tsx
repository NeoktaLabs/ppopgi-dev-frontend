// src/components/RaffleCard.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { formatUnits } from "ethers";

type Props = {
  raffle: RaffleListItem;
  onOpen: (id: string) => void;

  // Podium styling (top 3 only)
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
  return `${d}${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;
}

function baseStatusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

type DisplayStatus = "Open" | "Finalizing" | "Drawing" | "Settled" | "Canceled" | "Getting ready" | "Unknown";

function statusTheme(s: DisplayStatus) {
  if (s === "Open") return { bg: "rgba(145, 247, 184, 0.92)", fg: "#0B4A24", border: "1px solid rgba(0,0,0,0.06)" };
  if (s === "Finalizing")
    return { bg: "rgba(255, 120, 140, 0.92)", fg: "#5A0012", border: "1px solid rgba(0,0,0,0.10)", pulse: true };
  if (s === "Drawing")
    return { bg: "rgba(203, 183, 246, 0.92)", fg: "#2E1C5C", border: "1px solid rgba(0,0,0,0.08)" };
  if (s === "Settled")
    return { bg: "rgba(255, 216, 154, 0.92)", fg: "#4A2A00", border: "1px solid rgba(0,0,0,0.08)" };
  if (s === "Canceled")
    return { bg: "rgba(230, 234, 242, 0.92)", fg: "#2B2B33", border: "1px solid rgba(0,0,0,0.08)" };
  if (s === "Getting ready")
    return { bg: "rgba(169, 212, 255, 0.92)", fg: "#133A66", border: "1px solid rgba(0,0,0,0.08)" };
  return { bg: "rgba(255,255,255,0.72)", fg: "#5C2A3E", border: "1px solid rgba(0,0,0,0.08)" };
}

// Shiny podium “foil” backgrounds (only for top 3 cards)
function podiumFoil(kind: "gold" | "silver" | "bronze") {
  if (kind === "gold") {
    return {
      bg:
        "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)," +
        "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)," +
        "linear-gradient(135deg, rgba(255,216,154,0.98), rgba(255,190,120,0.90) 40%, rgba(255,232,190,0.92))",
      ink: "#4A2A00",
      inkStrong: "#3A1F00",
      tear: "rgba(150,88,0,0.55)",
    };
  }
  if (kind === "silver") {
    return {
      bg:
        "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)," +
        "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)," +
        "linear-gradient(135deg, rgba(236,241,250,0.98), rgba(218,226,238,0.92) 45%, rgba(245,248,255,0.92))",
      ink: "#1F2A3A",
      inkStrong: "#121B29",
      tear: "rgba(40,60,90,0.40)",
    };
  }
  // bronze
  return {
    bg:
      "radial-gradient(900px 280px at 20% 20%, rgba(255,255,255,0.82), rgba(255,255,255,0) 55%)," +
      "radial-gradient(700px 240px at 80% 25%, rgba(255,255,255,0.52), rgba(255,255,255,0) 60%)," +
      "linear-gradient(135deg, rgba(246,182,200,0.98), rgba(206,130,105,0.92) 45%, rgba(255,220,205,0.92))",
    ink: "#4A1A12",
    inkStrong: "#35110B",
    tear: "rgba(120,55,40,0.45)",
  };
}

export function RaffleCard({ raffle, onOpen, ribbon }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [isHover, setIsHover] = useState(false);

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

  // one user-facing status
  const deadlineMs = useMemo(() => {
    const n = Number(raffle.deadline);
    return Number.isFinite(n) ? n * 1000 : 0;
  }, [raffle.deadline]);

  const deadlinePassed = deadlineMs > 0 ? nowMs >= deadlineMs : false;

  const displayStatus: DisplayStatus = useMemo(() => {
    if (raffle.status === "OPEN" && deadlinePassed) return "Finalizing";
    return baseStatusLabel(raffle.status) as DisplayStatus;
  }, [raffle.status, deadlinePassed]);

  // “bottom line” should be short and friendly
  const bottomLine = useMemo(() => {
    if (displayStatus === "Open" || displayStatus === "Getting ready") return formatEndsIn(raffle.deadline, nowMs);
    if (displayStatus === "Finalizing") return "Draw in progress";
    if (displayStatus === "Drawing") return "Draw in progress";
    if (displayStatus === "Settled") return "Settled";
    if (displayStatus === "Canceled") return "Canceled";
    return "Unknown";
  }, [displayStatus, raffle.deadline, nowMs]);

  const soldNum = useMemo(() => Number(raffle.sold || "0") || 0, [raffle.sold]);
  const maxNum = useMemo(() => Number(raffle.maxTickets || "0") || 0, [raffle.maxTickets]);

  const soldLine = useMemo(() => (maxNum > 0 ? `${soldNum} / ${maxNum}` : `${soldNum}`), [soldNum, maxNum]);

  const soldPct = useMemo(() => {
    if (!maxNum) return null;
    const p = Math.max(0, Math.min(100, Math.round((soldNum / maxNum) * 100)));
    return p;
  }, [soldNum, maxNum]);

  const minTickets = useMemo(() => {
    const anyRaffle = raffle as any;
    const v = anyRaffle?.minTickets;
    if (v === undefined || v === null || v === "") return null;
    return String(v);
  }, [raffle]);

  const maxTicketsText = useMemo(() => {
    if (!maxNum) return "No limit";
    return String(maxNum);
  }, [maxNum]);

  // style palette
  const baseInk = "#5C1F3B";
  const baseInkStrong = "#4A0F2B";
  const foil = ribbon ? podiumFoil(ribbon) : null;

  const ink = foil?.ink ?? baseInk;
  const inkStrong = foil?.inkStrong ?? baseInkStrong;

  const status = statusTheme(displayStatus);

  const card: React.CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: 340,
    borderRadius: 22,
    padding: 16,
    cursor: "pointer",
    userSelect: "none",
    overflow: "hidden",

    background:
      foil?.bg ??
      "linear-gradient(180deg, rgba(255,190,215,0.92), rgba(255,210,230,0.78) 42%, rgba(255,235,246,0.82))",

    border: "1px solid rgba(255,255,255,0.78)",
    boxShadow: isHover ? "0 22px 46px rgba(0,0,0,0.18)" : "0 16px 34px rgba(0,0,0,0.14)",
    backdropFilter: "blur(14px)",
    transform: isHover ? "translateY(-4px)" : "translateY(0)",
    transition: "transform 140ms ease, box-shadow 140ms ease",
  };

  const notch: React.CSSProperties = {
    position: "absolute",
    top: "52%",
    transform: "translateY(-50%)",
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "rgba(255,255,255,0.62)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.14)",
    pointerEvents: "none",
  };

  const tearLine: React.CSSProperties = {
    marginTop: 14,
    height: 1,
    background:
      "repeating-linear-gradient(90deg, " +
      `${foil?.tear ?? "rgba(180,70,120,0.62)"} , ${foil?.tear ?? "rgba(180,70,120,0.62)"} 7px,` +
      " rgba(0,0,0,0) 7px, rgba(0,0,0,0) 14px)",
    opacity: 0.8,
    pointerEvents: "none",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  };

  const statusChip: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.35,
    whiteSpace: "nowrap",
    background: status.bg,
    color: status.fg,
    border: status.border,
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
    animation: status.pulse ? "ppPulse 950ms ease-in-out infinite" : undefined,
  };

  const shareBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(0,0,0,0.08)",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  };

  const titleWrap: React.CSSProperties = {
    marginTop: 10,
    textAlign: "center",
  };

  const smallKicker: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
    color: ink,
  };

  const titleText: React.CSSProperties = {
    marginTop: 4,
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: 0.1,
    lineHeight: 1.15,
    color: inkStrong,
  };

  const prizeKicker: React.CSSProperties = {
    marginTop: 14,
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.45,
    textTransform: "uppercase",
    opacity: 0.92,
    color: ink,
    textAlign: "center",
  };

  const prizeValue: React.CSSProperties = {
    marginTop: 8,
    fontSize: 34,
    fontWeight: 1000 as any,
    lineHeight: 1.0,
    letterSpacing: 0.2,
    textAlign: "center",
    color: inkStrong,
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
    background: "rgba(255,255,255,0.56)",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  const miniLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.25,
    opacity: 0.9,
    color: ink,
  };

  const miniValue: React.CSSProperties = {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 950,
    color: inkStrong,
  };

  const hint: React.CSSProperties = {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.88,
    color: ink,
  };

  const progressWrap: React.CSSProperties = { marginTop: 12 };

  const progressBar: React.CSSProperties = {
    height: 10,
    borderRadius: 999,
    background: "rgba(0,0,0,0.10)",
    overflow: "hidden",
  };

  const progressFill: React.CSSProperties = {
    height: "100%",
    width: `${soldPct ?? 0}%`,
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(246,182,200,0.98), rgba(203,183,246,0.92))",
  };

  const progressMeta: React.CSSProperties = {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    fontWeight: 950,
    color: ink,
  };

  const bottomRow: React.CSSProperties = {
    marginTop: 14,
    paddingTop: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  };

  const bottomText: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 950,
    color: inkStrong,
    letterSpacing: 0.2,
  };

  const copyToast: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    fontWeight: 950,
    color: ink,
    opacity: 0.95,
    textAlign: "center",
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
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      title="Open raffle"
    >
      <style>
        {`
          @keyframes ppPulse {
            0%   { transform: scale(1);   filter: saturate(1); }
            50%  { transform: scale(1.045); filter: saturate(1.2); }
            100% { transform: scale(1);   filter: saturate(1); }
          }
        `}
      </style>

      {/* Ticket notches */}
      <div style={{ ...notch, left: -9 }} />
      <div style={{ ...notch, right: -9 }} />

      <div style={topRow}>
        <div style={statusChip}>{displayStatus.toUpperCase()}</div>

        <button style={shareBtn} onClick={onShareCopy} title="Copy link" aria-label="Copy link">
          {/* clean share icon (arrow out of box) */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M14 3h7v7" stroke={inkStrong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 3l-9 9" stroke={inkStrong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M10 7H7a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3"
              stroke={inkStrong}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          </svg>
        </button>
      </div>

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
          <div style={miniLabel}>Min tickets</div>
          <div style={miniValue}>{minTickets ?? "—"}</div>
          <div style={hint}>Must reach this to draw</div>
        </div>
      </div>

      <div style={{ ...midGrid, marginTop: 12 }}>
        <div style={mini}>
          <div style={miniLabel}>Tickets</div>
          <div style={miniValue}>{soldLine}</div>
        </div>

        <div style={mini}>
          <div style={miniLabel}>Max tickets</div>
          <div style={miniValue}>{maxTicketsText}</div>
        </div>
      </div>

      <div style={progressWrap}>
        {soldPct !== null ? (
          <>
            <div style={progressBar}>
              <div style={progressFill} />
            </div>
            <div style={progressMeta}>
              <div>{soldPct}% sold</div>
              <div>{soldLine}</div>
            </div>
          </>
        ) : null}
      </div>

      <div style={bottomRow}>
        {/* Remove “ENDS:” for Finalizing/Drawing/Settled/Canceled; show clean bottom line */}
        <div style={bottomText}>
          {displayStatus === "Open" || displayStatus === "Getting ready" ? `Ends in ${bottomLine}` : bottomLine}
        </div>

        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke={inkStrong} strokeWidth="2" opacity="0.8" />
          <path d="M12 7v6l4 2" stroke={inkStrong} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        </svg>
      </div>

      {copyMsg && <div style={copyToast}>{copyMsg}</div>}
    </div>
  );
}