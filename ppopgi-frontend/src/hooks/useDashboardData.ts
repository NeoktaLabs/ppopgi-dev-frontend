// src/hooks/useDashboardData.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { fetchRafflesFromSubgraph } from "../indexer/subgraph";

type Result = {
  created: RaffleListItem[] | null;
  joined: RaffleListItem[] | null;
  note: string | null;
};

function norm(a: string) {
  return a.trim().toLowerCase();
}

// ✅ V2 deployer (exclude everything else = V1)
const V2_DEPLOYER = "0x6050196520e7010Aa39C8671055B674851E2426D";
const V2_DEPLOYER_N = norm(V2_DEPLOYER);

function isV2(r: RaffleListItem) {
  return norm(String(r.deployer || "")) === V2_DEPLOYER_N;
}

// Minimal GraphQL helper (kept local so we don’t disturb your existing indexer module)
async function subgraphRequest<T>(query: string, variables: any, signal?: AbortSignal): Promise<T> {
  const url = (import.meta as any).env?.VITE_SUBGRAPH_URL;
  if (!url) throw new Error("MISSING_ENV_VITE_SUBGRAPH_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(json.errors.map((e: any) => e.message).join(" | "));
  }
  return json.data as T;
}

export function useDashboardData(account: string | null, limit = 200) {
  const [created, setCreated] = useState<RaffleListItem[] | null>(null);
  const [joined, setJoined] = useState<RaffleListItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((x) => x + 1), []);

  const me = useMemo(() => (account ? norm(account) : null), [account]);

  useEffect(() => {
    if (!me) {
      setCreated(null);
      setJoined(null);
      setNote("Sign in to see your dashboard.");
      return;
    }

    let alive = true;
    const controller = new AbortController();

    (async () => {
      setNote(null);

      try {
        // 1) Load all raffles (indexer util you already have)
        const all = await fetchRafflesFromSubgraph({ signal: controller.signal });
        if (!alive) return;

        // ✅ Keep only V2 raffles
        const allV2 = all.filter(isV2);

        // Created by me
        const createdMine = allV2.filter((r: any) => {
          const creator = r.creator ? norm(String(r.creator)) : null;
          // best-effort fallback if creator is missing in some edge cases
          const deployer = r.deployer ? norm(String(r.deployer)) : null;
          return creator === me || deployer === me;
        });

        createdMine.sort(
          (a, b) => Number(b.lastUpdatedTimestamp || "0") - Number(a.lastUpdatedTimestamp || "0")
        );
        setCreated(createdMine.slice(0, limit));

        // 2) Find joined raffle IDs from RaffleEvent(TICKETS_PURCHASED, actor=me)
        const data = await subgraphRequest<{
          raffleEvents: Array<{ raffle: { id: string } }>;
        }>(
          `
          query JoinedRaffles($actor: Bytes!, $n: Int!) {
            raffleEvents(
              first: $n
              orderBy: blockTimestamp
              orderDirection: desc
              where: { type: TICKETS_PURCHASED, actor: $actor }
            ) {
              raffle { id }
            }
          }
          `,
          { actor: me, n: 1000 },
          controller.signal
        );

        if (!alive) return;

        const ids = Array.from(
          new Set((data?.raffleEvents ?? []).map((e) => String(e?.raffle?.id)).filter(Boolean))
        );

        // ✅ Map joined IDs back to V2-only list (drops V1 automatically)
        const byId = new Map(allV2.map((r) => [norm(r.id), r]));
        const joinedMine: RaffleListItem[] = ids
          .map((id) => byId.get(norm(id)))
          .filter(Boolean) as RaffleListItem[];

        joinedMine.sort(
          (a, b) => Number(b.lastUpdatedTimestamp || "0") - Number(a.lastUpdatedTimestamp || "0")
        );
        setJoined(joinedMine.slice(0, limit));

        setNote(null);
      } catch {
        if (!alive) return;
        setCreated([]);
        setJoined([]);
        setNote("Could not load your dashboard right now. Please refresh.");
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [me, limit, refreshKey]);

  const result: Result = { created, joined, note };
  return { ...result, refetch };
}