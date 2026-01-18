// src/hooks/useHomeRaffles.ts
import { useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../onchain/fallbackRaffles";

type Mode = "indexer" | "live";

export function useHomeRaffles() {
  const [items, setItems] = useState<RaffleListItem[] | null>(null);
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      // 1) indexer-first (with timeout)
      try {
        const t = setTimeout(() => controller.abort(), 4500);
        const data = await fetchRafflesFromSubgraph(controller.signal);
        clearTimeout(t);

        if (!alive) return;
        setMode("indexer");
        setNote(null);
        setItems(data);
        return;
      } catch {
        // fall through
      }

      // 2) automatic fallback: on-chain reads
      try {
        if (!alive) return;
        setMode("live");
        setNote("Showing live data. This may take a moment.");

        const data = await fetchRafflesOnChainFallback(120);
        if (!alive) return;

        setItems(data);
      } catch {
        if (!alive) return;
        setNote("Could not load raffles right now. Please refresh.");
        setItems([]);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const active = useMemo(() => {
    const all = items ?? [];
    return all.filter((r) => r.status === "OPEN" || r.status === "FUNDING_PENDING");
  }, [items]);

  // Big prizes: top 3 active by winningPot
  const bigPrizes = useMemo(() => {
    return [...active]
      .sort((a, b) => BigInt(b.winningPot) > BigInt(a.winningPot) ? 1 : -1)
      .slice(0, 3);
  }, [active]);

  // Ending soon: top 5 OPEN by deadline ascending
  const endingSoon = useMemo(() => {
    return [...active]
      .filter((r) => r.status === "OPEN")
      .sort((a, b) => Number(a.deadline) - Number(b.deadline))
      .slice(0, 5);
  }, [active]);

  return { items, bigPrizes, endingSoon, mode, note };
}