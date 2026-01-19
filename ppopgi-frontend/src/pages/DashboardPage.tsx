// src/pages/DashboardPage.tsx
import React from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { RaffleCard } from "../components/RaffleCard";

type Props = {
  account: string | null;
  onOpenRaffle: (id: string) => void;
};

export function DashboardPage({ account, onOpenRaffle }: Props) {
  const { created, joined, note } = useDashboardData(account, 250);

  const section: React.CSSProperties = {
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
  };

  const grid: React.CSSProperties = { marginTop: 10, display: "grid", gap: 10 };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {account ? "Your activity" : "Sign in required"}
        </div>
      </div>

      {note && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          {note}
        </div>
      )}

      <div style={section}>
        <div style={{ fontWeight: 800 }}>Your created raffles</div>
        <div style={grid}>
          {(created ?? []).map((r) => (
            <RaffleCard key={r.id} raffle={r} onOpen={onOpenRaffle} />
          ))}
          {created && created.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              No created raffles yet.
            </div>
          )}
          {!created && (
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Loading…
            </div>
          )}
        </div>
      </div>

      <div style={section}>
        <div style={{ fontWeight: 800 }}>Raffles you joined</div>
        <div style={grid}>
          {(joined ?? []).map((r) => (
            <RaffleCard key={r.id} raffle={r} onOpen={onOpenRaffle} />
          ))}
          {joined && joined.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              You haven’t joined any raffles yet.
            </div>
          )}
          {!joined && (
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Loading…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}