// src/hooks/useExploreRaffles.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../onchain/fallbackRaffles";

type Mode = "indexer" | "live";

// ✅ V2 deployer (exclude everything else = V1)
const V2_DEPLOYER = "0x6050196520e7010Aa39C8671055B674851E2426D";
function norm(a: string) {
  return a.trim().toLowerCase();
}
function isV2(r: RaffleListItem) {
  return norm(r.deployer ?? "") === norm(V2_DEPLOYER);
}

export function useExploreRaffles(limit = 500) {
  const [items, setItems] = useState<RaffleListItem[] | null>(null);
  const [mode, setMode] = useState<Mode>("indexer");
  const [note, setNote] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((x) => x + 1), []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      setNote(null);

      // 1) indexer-first (with timeout)
      let t: number | null = null;
      try {
        t = window.setTimeout(() => controller.abort(), 4500);

        const data = await fetchRafflesFromSubgraph({ signal: controller.signal });

        if (t) window.clearTimeout(t);
        t = null;

        if (!alive) return;

        setMode("indexer");
        setNote(null);

        // ✅ Filter out V1 first
        const v2 = data.filter(isV2);

        // Explore: newest first (best effort)
        const sorted = [...v2].sort((a, b) => {
          const A = Number(a.lastUpdatedTimestamp || "0");
          const B = Number(b.lastUpdatedTimestamp || "0");
          return B - A;
        });

        setItems(sorted.slice(0, limit));
        return;
      } catch {
        if (t) window.clearTimeout(t);
        t = null;
        // fall through to live fallback
      }

      // 2) fallback: on-chain reads
      try {
        if (!alive) return;
        setMode("live");
        setNote("Showing live data. This may take a moment.");

        const data = await fetchRafflesOnChainFallback(Math.min(limit, 200));
        if (!alive) return;

        // ✅ Filter out V1 here too
        const v2 = data.filter(isV2);

        // Keep Explore consistent: "newest-ish first"
        // Fallback loads newest registry entries first; still safe to slice:
        setItems(v2.slice(0, limit));
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
  }, [refreshKey, limit]);

  // ✅ Extra safety: never return V1 even if state gets polluted
  const safeItems = useMemo(() => (items ?? null ? (items ?? []).filter(isV2) : null), [items]);

  return { items: safeItems, mode, note, refetch };
}