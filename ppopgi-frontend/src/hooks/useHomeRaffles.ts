// src/hooks/useHomeRaffles.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../indexer/subgraph";
import { fetchRafflesOnChainFallback } from "../onchain/fallbackRaffles";

type Mode = "indexer" | "live";

function numOr0(v?: string | null) {
  const n = Number(v || "0");
  return Number.isFinite(n) ? n : 0;
}

// ✅ V2 deployer (exclude everything else = V1)
const V2_DEPLOYER = "0x6050196520e7010Aa39C8671055B674851E2426D";
function norm(a: string) {
  return a.trim().toLowerCase();
}
function isV2(r: RaffleListItem) {
  return norm(r.deployer ?? "") === norm(V2_DEPLOYER);
}

export function useHomeRaffles() {
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
      try {
        const t = window.setTimeout(() => controller.abort(), 4500);
        const data = await fetchRafflesFromSubgraph({ signal: controller.signal });
        window.clearTimeout(t);

        if (!alive) return;
        setMode("indexer");
        setNote(null);

        // ✅ Filter out V1
        setItems(data.filter(isV2));
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

        // ✅ Filter out V1 here too
        setItems(data.filter(isV2));
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
  }, [refreshKey]);

  // ✅ Always work from V2-only set (even if something slips through)
  const all = useMemo(() => (items ?? []).filter(isV2), [items]);

  const active = useMemo(() => {
    return all.filter((r) => r.status === "OPEN" || r.status === "FUNDING_PENDING");
  }, [all]);

  // ✅ Big prizes: top 3 active by winningPot (descending)
  const bigPrizes = useMemo(() => {
    return [...active]
      .sort((a, b) => {
        const A = BigInt(a.winningPot || "0");
        const B = BigInt(b.winningPot || "0");
        if (A === B) return 0;
        return A > B ? -1 : 1;
      })
      .slice(0, 3);
  }, [active]);

  // ✅ Ending soon: top 5 OPEN by deadline ascending
  const endingSoon = useMemo(() => {
    return [...active]
      .filter((r) => r.status === "OPEN")
      .sort((a, b) => numOr0(a.deadline) - numOr0(b.deadline))
      .slice(0, 5);
  }, [active]);

  // ✅ Recently finalized/settled: top 5 COMPLETED by completedAt (fallback to finalizedAt)
  const recentlyFinalized = useMemo(() => {
    if (mode === "live") return [];

    const settled = all.filter((r) => r.status === "COMPLETED");

    return [...settled]
      .sort((a, b) => {
        const aKey = numOr0(a.completedAt) || numOr0(a.finalizedAt) || numOr0(a.lastUpdatedTimestamp);
        const bKey = numOr0(b.completedAt) || numOr0(b.finalizedAt) || numOr0(b.lastUpdatedTimestamp);
        return bKey - aKey;
      })
      .slice(0, 5);
  }, [all, mode]);

  return { items: all, bigPrizes, endingSoon, recentlyFinalized, mode, note, refetch };
}