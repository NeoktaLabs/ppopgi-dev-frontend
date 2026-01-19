// src/hooks/useHomeRaffles.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../onchain/fallbackRaffles";

type Mode = "indexer" | "live";

export function useHomeRaffles() {
  const [items, setItems] = useState<RaffleListItem[] | null>(null);
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);

  // ✅ allows App to trigger reload
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((x) => x + 1), []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      // reset state for a clean refetch UX
      setNote(null);

      // 1) indexer-first (with timeout)
      try {
        const t = window.setTimeout(() => controller.abort(), 4500);
        const data = await fetchRafflesFromSubgraph(controller.signal);
        window.clearTimeout(t);

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
  }, [refreshKey]); // ✅ refetch triggers this

  const active = useMemo(() => {
    const all = items ?? [];
    return all.filter((r) => r.status === "OPEN" || r.status === "FUNDING_PENDING");
  }, [items]);

  // ✅ Big prizes: top 3 active by winningPot (descending)
  const bigPrizes = useMemo(() => {
    return [...active]
      .sort((a, b) => {
        const A = BigInt(a.winningPot || "0");
        const B = BigInt(b.winningPot || "0");
        if (A === B) return 0;
        return A > B ? -1 : 1; // descending
      })
      .slice(0, 3);
  }, [active]);

  // ✅ Ending soon: top 5 OPEN by deadline ascending
  const endingSoon = useMemo(() => {
    return [...active]
      .filter((r) => r.status === "OPEN")
      .sort((a, b) => {
        const A = Number(a.deadline || "0");
        const B = Number(b.deadline || "0");
        return A - B;
      })
      .slice(0, 5);
  }, [active]);

  return { items, bigPrizes, endingSoon, mode, note, refetch };
}