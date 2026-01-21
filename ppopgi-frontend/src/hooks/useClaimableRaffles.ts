// src/hooks/useClaimableRaffles.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaffleListItem } from "../indexer/subgraph";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function normAddr(a: string) {
  return a.trim().toLowerCase();
}

export type ClaimableRaffleItem = {
  raffle: RaffleListItem;
  roles: { created: boolean; participated: boolean };

  // live on-chain claimables for the active user
  claimableUsdc: string; // raw uint256 as string
  claimableNative: string; // raw uint256 as string
  isCreator: boolean;
};

type Mode = "indexer" | "empty";

export function useClaimableRaffles(userAddress: string | null, limit = 200) {
  const [items, setItems] = useState<ClaimableRaffleItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("indexer");

  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((x) => x + 1), []);

  const me = useMemo(() => (userAddress ? normAddr(userAddress) : null), [userAddress]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function fetchFromSubgraph(): Promise<{
      merged: Array<{ raffle: RaffleListItem; roles: { created: boolean; participated: boolean } }>;
    }> {
      const url = mustEnv("VITE_SUBGRAPH_URL");
      const user = me; // string lowercased

      // We query created raffles + participated raffles via events.
      const query = `
        query Claimables($user: Bytes!, $first: Int!) {
          created: raffles(first: $first, where: { creator: $user }) {
            id
            name
            status
            winningPot
            ticketPrice
            deadline
            sold
            maxTickets
            protocolFeePercent
            feeRecipient
            deployer
            lastUpdatedTimestamp
          }

          participated: raffleEvents(
            first: $first,
            orderBy: blockTimestamp,
            orderDirection: desc,
            where: { type: TICKETS_PURCHASED, actor: $user }
          ) {
            raffle {
              id
              name
              status
              winningPot
              ticketPrice
              deadline
              sold
              maxTickets
              protocolFeePercent
              feeRecipient
              deployer
              lastUpdatedTimestamp
              creator
            }
          }
        }
      `;

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables: { user, first: limit } }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("SUBGRAPH_HTTP_ERROR");
      const json = await res.json();
      if (json?.errors?.length) throw new Error("SUBGRAPH_GQL_ERROR");

      const created = (json.data?.created ?? []) as RaffleListItem[];
      const participatedEvents = (json.data?.participated ?? []) as Array<{ raffle: any }>;
      const participated = participatedEvents.map((e) => e.raffle).filter(Boolean) as RaffleListItem[];

      // Merge + dedupe with roles
      const byId = new Map<string, { raffle: RaffleListItem; roles: { created: boolean; participated: boolean } }>();

      for (const r of created) {
        byId.set(normAddr(r.id), { raffle: r, roles: { created: true, participated: false } });
      }

      for (const r of participated) {
        const key = normAddr(r.id);
        const prev = byId.get(key);
        if (prev) {
          prev.roles.participated = true;
        } else {
          byId.set(key, { raffle: r, roles: { created: false, participated: true } });
        }
      }

      const merged = Array.from(byId.values());

      // Sort: newest activity-ish first (lastUpdatedTimestamp desc)
      merged.sort((a, b) => {
        const A = Number(a.raffle.lastUpdatedTimestamp || "0");
        const B = Number(b.raffle.lastUpdatedTimestamp || "0");
        return B - A;
      });

      return { merged };
    }

    async function enrichOnChain(
      merged: Array<{ raffle: RaffleListItem; roles: { created: boolean; participated: boolean } }>
    ): Promise<ClaimableRaffleItem[]> {
      if (!me) return [];

      // Lightweight on-chain reads for each raffle:
      // claimableFunds(me), claimableNative(me), creator()
      const out: ClaimableRaffleItem[] = [];

      // small concurrency control (avoid blasting RPC)
      const batchSize = 10;
      for (let i = 0; i < merged.length; i += batchSize) {
        const slice = merged.slice(i, i + batchSize);

        const results = await Promise.all(
          slice.map(async ({ raffle, roles }) => {
            const raffleContract = getContract({
              client: thirdwebClient,
              chain: ETHERLINK_CHAIN,
              address: raffle.id,
            });

            const [claimableUsdc, claimableNative, creator] = await Promise.all([
              readContract({
                contract: raffleContract,
                method: "function claimableFunds(address) view returns (uint256)",
                params: [me],
              }).catch(() => 0n),
              readContract({
                contract: raffleContract,
                method: "function claimableNative(address) view returns (uint256)",
                params: [me],
              }).catch(() => 0n),
              readContract({
                contract: raffleContract,
                method: "function creator() view returns (address)",
                params: [],
              }).catch(() => "0x0000000000000000000000000000000000000000"),
            ]);

            const creatorAddr = normAddr(String(creator));
            const isCreator = creatorAddr === me;

            return {
              raffle,
              roles,
              claimableUsdc: String(claimableUsdc),
              claimableNative: String(claimableNative),
              isCreator,
            } satisfies ClaimableRaffleItem;
          })
        );

        out.push(...results);
        if (!alive) return out;
      }

      return out;
    }

    (async () => {
      if (!me) {
        setMode("empty");
        setNote("Sign in to see your claims.");
        setItems([]);
        return;
      }

      setNote(null);
      setMode("indexer");
      setItems(null);

      try {
        const { merged } = await fetchFromSubgraph();
        if (!alive) return;

        if (!merged.length) {
          setItems([]);
          setNote("No raffles found for your address yet.");
          return;
        }

        const enriched = await enrichOnChain(merged);
        if (!alive) return;

        setItems(enriched);
        setNote(null);
      } catch {
        if (!alive) return;
        setItems([]);
        setNote("Could not load your claims right now. Please refresh.");
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [me, limit, refreshKey]);

  return { items, note, mode, refetch };
}

/**
 * Backwards compatible alias (so existing imports keep working).
 * You can remove this after you update all imports.
 */
export const useCashierRaffles = useClaimableRaffles;
export type CashierRaffleItem = ClaimableRaffleItem;