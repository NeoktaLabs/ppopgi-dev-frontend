// src/pages/DashboardPage.tsx
import React, { useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { RaffleCard } from "../components/RaffleCard";

import { useClaimableRaffles } from "../hooks/useClaimableRaffles";
import { useDashboardData } from "../hooks/useDashboardData";

import { getContract, prepareContractCall } from "thirdweb";
import { useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  account: string | null;
  onOpenRaffle: (id: string) => void;
};

function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 6);
  } catch {
    return "0";
  }
}

function fmtNative(raw: string) {
  try {
    return formatUnits(BigInt(raw || "0"), 18);
  } catch {
    return "0";
  }
}

const RAFFLE_MIN_ABI = [
  { type: "function", name: "withdrawFunds", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "withdrawNative", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimTicketRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

type MethodName = "withdrawFunds" | "withdrawNative" | "claimTicketRefund";

function hasAnyClaimable(it: any) {
  try {
    const usdc = BigInt(it?.claimableUsdc || "0");
    const nat = BigInt(it?.claimableNative || "0");
    // refund eligibility is a role-based CTA; actual claimable might still be 0
    return usdc > 0n || nat > 0n;
  } catch {
    return false;
  }
}

export function DashboardPage({ account, onOpenRaffle }: Props) {
  const dash = useDashboardData(account, 250);
  const claim = useClaimableRaffles(account, 250);

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  const [msg, setMsg] = useState<string | null>(null);

  // ✅ optimistic hide after successful claim (prevents “still showing after claim”)
  const [hiddenClaimables, setHiddenClaimables] = useState<Record<string, boolean>>({});

  const created = dash.created ?? null;
  const joined = dash.joined ?? null;

  const claimablesRaw = claim.items ?? null;

  // ✅ filter: hide items we've claimed + hide zero-amount rows
  const claimables = useMemo(() => {
    if (!claimablesRaw) return null;
    return claimablesRaw
      .filter((it: any) => {
        const id = String(it?.raffle?.id || "");
        if (!id) return false;
        if (hiddenClaimables[id]) return false;

        // If your hook sometimes returns 0/0, drop it so UI stays clean.
        // Refund-only rows (no amount) can be handled once you have a real "refundable" signal.
        return hasAnyClaimable(it) || !!it?.roles?.participated;
      })
      .sort((a: any, b: any) => {
        // sort highest value first (nice UX)
        const Au = BigInt(a?.claimableUsdc || "0");
        const Bu = BigInt(b?.claimableUsdc || "0");
        if (Au !== Bu) return Au > Bu ? -1 : 1;

        const An = BigInt(a?.claimableNative || "0");
        const Bn = BigInt(b?.claimableNative || "0");
        if (An !== Bn) return An > Bn ? -1 : 1;

        return String(a?.raffle?.id || "").localeCompare(String(b?.raffle?.id || ""));
      });
  }, [claimablesRaw, hiddenClaimables]);

  // --- styles (match your newer glass / pill vibe) ---
  const section: React.CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.55)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10))," +
      "radial-gradient(900px 220px at 15% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 220px at 85% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    boxShadow: "0 16px 34px rgba(0,0,0,0.12)",
    backdropFilter: "blur(10px)",
  };

  const grid: React.CSSProperties = { marginTop: 12, display: "grid", gap: 12 };

  const pill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    color: "#4A0F2B",
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const pillMuted: React.CSSProperties = {
    ...pill,
    cursor: "default",
    opacity: 0.85,
  };

  const actionBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.82)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: "pointer",
    fontWeight: 1000,
    color: "#4A0F2B",
    width: "100%",
  };

  const actionBtnDisabled: React.CSSProperties = { ...actionBtn, opacity: 0.55, cursor: "not-allowed" };

  const subCard: React.CSSProperties = {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.20)",
    display: "grid",
    gap: 10,
  };

  async function callRaffleTx(raffleId: string, method: MethodName) {
    setMsg(null);

    if (!account) {
      setMsg("Please sign in first.");
      return;
    }

    try {
      const raffleContract = getContract({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: raffleId,
        abi: RAFFLE_MIN_ABI,
      });

      const tx = prepareContractCall({ contract: raffleContract, method, params: [] as const });
      await sendAndConfirm(tx);

      // ✅ optimistic remove: hide claimable immediately after success
      setHiddenClaimables((prev) => ({ ...prev, [raffleId]: true }));

      setMsg("Done. Your claim will disappear shortly.");
      // still refetch to sync subgraph
      claim.refetch();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not complete this action right now.");
    }
  }

  function renderClaimableItem(it: any) {
    const raffle = it.raffle;

    const hasUsdc = BigInt(it.claimableUsdc || "0") > 0n;
    const hasNative = BigInt(it.claimableNative || "0") > 0n;

    // This line is “truthy”: user sees why the raffle is here.
    const statusLine =
      hasUsdc || hasNative
        ? "You have funds available to claim."
        : it.roles?.participated
          ? "You may have a refundable ticket (if the raffle was canceled)."
          : "Nothing to claim right now.";

    return (
      <div key={raffle.id}>
        <RaffleCard raffle={raffle} onOpen={onOpenRaffle} />

        <div style={subCard}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {it.roles?.created && <span style={pillMuted}>Created</span>}
            {it.roles?.participated && <span style={pillMuted}>Participated</span>}
            {it.isCreator && <span style={pillMuted}>You are creator</span>}
          </div>

          <div style={{ fontSize: 13, opacity: 0.92, color: "#4A0F2B", fontWeight: 900 }}>
            {statusLine}
          </div>

          <div style={{ fontSize: 13, opacity: 0.92, color: "#4A0F2B" }}>
            Claimable USDC: <b>{fmtUsdc(it.claimableUsdc)} USDC</b> • Claimable native: <b>{fmtNative(it.claimableNative)}</b>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              style={hasUsdc && !isPending ? actionBtn : actionBtnDisabled}
              disabled={!hasUsdc || isPending}
              onClick={() => callRaffleTx(raffle.id, "withdrawFunds")}
            >
              {isPending ? "Confirming…" : "Withdraw USDC"}
            </button>

            <button
              style={hasNative && !isPending ? actionBtn : actionBtnDisabled}
              disabled={!hasNative || isPending}
              onClick={() => callRaffleTx(raffle.id, "withdrawNative")}
            >
              {isPending ? "Confirming…" : "Withdraw native"}
            </button>
          </div>

          {it.roles?.participated && (
            <button
              style={!isPending ? actionBtn : actionBtnDisabled}
              disabled={isPending}
              onClick={() => callRaffleTx(raffle.id, "claimTicketRefund")}
              title="Only works if a ticket refund is actually available on-chain."
            >
              {isPending ? "Confirming…" : "Claim ticket refund"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, color: "#4A0F2B" }}>Dashboard</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#4A0F2B" }}>
            {account ? "Your activity" : "Sign in required"}
          </div>

          <button
            style={pill}
            onClick={() => {
              setMsg(null);
              setHiddenClaimables({});
              dash.refetch();
              claim.refetch();
            }}
            disabled={isPending}
            title="Refresh data"
          >
            Refresh
          </button>
        </div>
      </div>

      {(dash.note || claim.note) && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, color: "#4A0F2B" }}>
          {dash.note || claim.note}
        </div>
      )}
      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.95, color: "#4A0F2B", fontWeight: 900 }}>
          {msg}
        </div>
      )}

      <div style={section}>
        <div style={{ fontWeight: 1000, color: "#4A0F2B" }}>Your created raffles</div>
        <div style={grid}>
          {!created && <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Loading…</div>}
          {created && created.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>No created raffles yet.</div>
          )}
          {created?.map((raffle) => (
            <div key={raffle.id}>
              <RaffleCard raffle={raffle} onOpen={onOpenRaffle} />
            </div>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={{ fontWeight: 1000, color: "#4A0F2B" }}>Raffles you joined</div>
        <div style={grid}>
          {!joined && <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Loading…</div>}
          {joined && joined.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>
              You haven’t joined any raffles yet.
            </div>
          )}
          {joined?.map((raffle) => (
            <div key={raffle.id}>
              <RaffleCard raffle={raffle} onOpen={onOpenRaffle} />
            </div>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <div style={{ fontWeight: 1000, color: "#4A0F2B" }}>Claimables</div>
          <div style={{ fontSize: 12, opacity: 0.85, color: "#4A0F2B" }}>
            {claimables ? `${claimables.length} items` : "…"}
          </div>
        </div>

        <div style={grid}>
          {!claimables && <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Loading…</div>}
          {claimables && claimables.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13, color: "#4A0F2B" }}>Nothing to claim right now.</div>
          )}
          {claimables?.map(renderClaimableItem)}
        </div>
      </div>
    </div>
  );
}