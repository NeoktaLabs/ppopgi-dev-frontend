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
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

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

function extractMinTickets(raffle: RaffleListItem): string | null {
  // only show if your list item includes it (some queries don't)
  const anyR = raffle as any;
  const v = anyR?.minTickets;
  if (v === undefined || v === null) return null;
  const s = String(v);
  return s && s !== "0" ? s : null;
}

export function RaffleCard({ raffle, onOpen }: Props) {
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

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

  const deadlineMs = useMemo(() => {
    const n = Number(raffle.deadline);
    return Number.isFinite(n) ? n * 1000 : 0;
  }, [raffle.deadline]);

  const deadlinePassed = deadlineMs > 0 ? nowMs >= deadlineMs : false;

  const displayStatus = useMemo(() => {
    if (raffle.status === "OPEN" && deadlinePassed) return "Finalizing…";
    return statusLabel(raffle.status);
  }, [raffle.status, deadlinePassed]);

  const statusHint = useMemo(() => {
    if (!deadlinePassed) return null;
    if (raffle.status === "OPEN") return "Deadline passed — finalization is pending.";
    if (raffle.status === "DRAWING") return "Winner selection is in progress.";
    return null;
  }, [deadlinePassed, raffle.status]);

  const tone = statusTone(raffle.status);
  const max = raffle.maxTickets !== "0" ? raffle.maxTickets : null;
  const min = extractMinTickets(raffle);

  async function onShareClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const title = raffle?.name ? `Ppopgi — ${raffle.name}` : "Ppopgi raffle";
    const text = raffle?.name ? `Join this raffle: ${raffle.name}` : "Join this raffle";

    try {
      // ✅ native share when available (no submenu UI)
      if ((navigator as any).share) {
        await (navigator as any).share({ title, text, url: shareUrl });
        return;
      }

      // fallback: copy link
      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg("Link copied.");
      window.setTimeout(() => setCopyMsg(null), 900);
    } catch {
      // last resort
      window.prompt("Copy this link:", shareUrl);
    }
  }

  return (
    <div
      className={`pp-ticket2 pp-ticket2--${tone}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(raffle.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(raffle.id);
      }}
      title="Open raffle"
    >
      {/* header */}
      <div className="pp-ticket2__header">
        <div className="pp-ticket2__title" title={raffle.name}>
          {raffle.name}
        </div>

        <div className="pp-ticket2__headerRight">
          <div className={`pp-stamp2 pp-stamp2--${tone}`}>{displayStatus}</div>

          <button className="pp-shareBtn2" onClick={onShareClick} title="Share">
            Share
          </button>
        </div>
      </div>

      {/* prize row (make prize POP) */}
      <div className="pp-ticket2__prizeRow">
        <div className="pp-prizeBig">
          <span className="pp-prizeBig__label">Prize</span>
          <span className="pp-prizeBig__value">{fmtUsdc(raffle.winningPot)} USDC</span>
        </div>

        <div className="pp-miniFacts">
          <div className="pp-miniFact">
            <div className="pp-miniFact__k">Ticket</div>
            <div className="pp-miniFact__v">{fmtUsdc(raffle.ticketPrice)} USDC</div>
          </div>

          <div className="pp-miniFact">
            <div className="pp-miniFact__k">Fee</div>
            <div className="pp-miniFact__v">{raffle.protocolFeePercent}%</div>
          </div>
        </div>
      </div>

      {/* tear line */}
      <div className="pp-tear2" aria-hidden="true" />

      {/* bottom info */}
      <div className="pp-ticket2__bottom">
        <div className="pp-bottomLine">
          <span className="pp-bottomK">Time</span>
          <span className="pp-bottomV">{formatEndsIn(raffle.deadline, nowMs)}</span>
        </div>

        <div className="pp-bottomLine">
          <span className="pp-bottomK">Tickets</span>
          <span className="pp-bottomV">
            {raffle.sold}
            {max ? ` / ${max}` : ""}
            {min ? ` • min ${min}` : ""}
          </span>
        </div>

        {statusHint && <div className="pp-hint2">{statusHint}</div>}

        {copyMsg && <div className="pp-toast2">{copyMsg}</div>}
      </div>
    </div>
  );
}