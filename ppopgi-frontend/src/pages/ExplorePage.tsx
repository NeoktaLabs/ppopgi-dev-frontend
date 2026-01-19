// src/pages/ExplorePage.tsx
import React, { useMemo, useState } from "react";
import type { RaffleListItem, RaffleStatus } from "../indexer/subgraph";
import { RaffleCard } from "../components/RaffleCard";

type Props = {
  items: RaffleListItem[] | null;
  note: string | null;
  onOpenRaffle: (id: string) => void;
};

type SortMode = "endingSoon" | "bigPrize" | "newest";

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function ExplorePage({ items, note, onOpenRaffle }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RaffleStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortMode>("endingSoon");

  const list = useMemo(() => {
    const all = items ?? [];

    // filter by status
    let filtered = status === "ALL" ? all : all.filter((r) => r.status === status);

    // search: name or address
    const query = norm(q);
    if (query) {
      filtered = filtered.filter((r) => {
        const hay = `${r.name} ${r.id}`.toLowerCase();
        return hay.includes(query);
      });
    }

    // sort
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "endingSoon") {
        const A = Number(a.deadline || "0");
        const B = Number(b.deadline || "0");
        return A - B; // soonest first
      }
      if (sort === "bigPrize") {
        const A = BigInt(a.winningPot || "0");
        const B = BigInt(b.winningPot || "0");
        if (A === B) return 0;
        return A > B ? -1 : 1; // biggest first
      }
      // newest (best effort): lastUpdatedTimestamp desc, fallback to id
      const A = Number(a.lastUpdatedTimestamp || "0");
      const B = Number(b.lastUpdatedTimestamp || "0");
      if (A !== B) return B - A;
      return a.id.localeCompare(b.id);
    });

    return sorted;
  }, [items, q, status, sort]);

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.35)",
    borderRadius: 12,
    padding: "10px 10px",
    outline: "none",
    color: "#2B2B33",
  };

  const select: React.CSSProperties = {
    ...input,
    cursor: "pointer",
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Explore</h2>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{items ? `${items.length} raffles` : "…"}</div>
      </div>

      {note && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          {note}
        </div>
      )}

      {/* Filters */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>Search</div>
          <input
            style={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or address…"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>Status</div>
            <select style={select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="ALL">All</option>
              <option value="FUNDING_PENDING">Getting ready</option>
              <option value="OPEN">Open</option>
              <option value="DRAWING">Drawing</option>
              <option value="COMPLETED">Settled</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>Sort</div>
            <select style={select} value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="endingSoon">Ending soon</option>
              <option value="bigPrize">Big prize</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {list.map((r) => (
          <RaffleCard key={r.id} raffle={r} onOpen={onOpenRaffle} />
        ))}

        {items && list.length === 0 && (
          <div style={{ opacity: 0.85 }}>No raffles match your filters.</div>
        )}

        {!items && (
          <div style={{ opacity: 0.85 }}>Loading raffles…</div>
        )}
      </div>
    </div>
  );
}