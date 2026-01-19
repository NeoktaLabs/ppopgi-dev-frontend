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

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "baseline",
  };

  const shareBtn: React.CSSProperties = {
    border: "1px solid rgba(0