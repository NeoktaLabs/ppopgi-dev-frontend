// src/pages/DashboardPage.tsx
import React, { useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { RaffleCard } from "../components/RaffleCard";

import { useClaimableRaffles } from "../hooks/useClaimableRaffles";
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

// ✅ Type-safe method string for thirdweb
type MethodSig = `function ${string}`;

export function DashboardPage({ account, onOpenRaffle }: Props) {
  const { items, note, refetch } = useClaimableRaffles(account, 250);

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  const [msg, setMsg] = useState<string | null>(null);

  const created = useMemo(() => {
    if (!items) return null;
    return items.filter((it) => it.roles.created);
  }, [items]);

  const joined = useMemo(() => {
    if (!items) return null;
    return items.filter((it) => it.roles.participated);
  }, [items]);

  const section: React.CSSProperties = {
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
  };

  const grid: React.CSSProperties = { marginTop: 10, display: "grid", gap: 10 };

  const pill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.65)",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    color: "#2B2B33",
    fontWeight: 800,
    fontSize: 12,
  };

  const actionBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.24)",
    borderRadius: 12,
    padding: "10px 10px",
    cursor: "pointer",
    fontWeight: 800,
    color: "#2B2B33",
    width: "100%",
  };

  const actionBtnDisabled: React.CSSProperties = {
    ...actionBtn,
    opacity: 0.55,
    cursor: "not-allowed",
  };

  async function callRaffleTx(raffleId: string, method: MethodSig) {
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
      });

      const tx = prepareContractCall({
        contract: raffleContract,
        method,
        params: [],
      });

      await sendAndConfirm(tx);
      setMsg("Done.");
      refetch();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not complete this action right now.");
    }
  }

  function renderItem(it: any) {
    const raffle = it.raffle;

    const hasUsdc = BigInt(it.claimableUsdc || "0") > 0n;
    const hasNative = BigInt(it.claimableNative || "0") > 0n;

    // Transparent message
    const statusLine = hasUsdc || hasNative ? "You have funds available to claim." : "Nothing to claim right now.";

    return (
      <div key={raffle.id}>
        <RaffleCard raffle={raffle} onOpen={onOpenRaffle} />

        {/* Actions + transparency footer */}
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.18)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {it.roles.created && <span style={pill}>Created</span>}
            {it.roles.participated && <span style={pill}>Participated</span>}
            {it.isCreator && <span style={pill}>You are creator</span>}
          </div>

          <div style={{ fontSize: 13, opacity: 0.9 }}>{statusLine}</div>

          <div style={{ fontSize: 13, opacity: 0.9 }}>
            Claimable USDC: <b>{fmtUsdc(it.claimableUsdc)} USDC</b> • Claimable native:{" "}
            <b>{fmtNative(it.claimableNative)}</b>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              style={hasUsdc && !isPending ? actionBtn : actionBtnDisabled}
              disabled={!hasUsdc || isPending}
              onClick={() => callRaffleTx(raffle.id, "function withdrawFunds()")}
              title="Withdraw your claimable USDC (if available)"
            >
              {isPending ? "Confirming…" : "Withdraw USDC"}
            </button>

            <button
              style={hasNative && !isPending ? actionBtn : actionBtnDisabled}
              disabled={!hasNative || isPending}
              onClick={() => callRaffleTx(raffle.id, "function withdrawNative()")}
              title="Withdraw your claimable native (if available)"
            >
              {isPending ? "Confirming…" : "Withdraw native"}
            </button>
          </div>

          {/* Refund path (participants) — keep available; contract will gate if not eligible */}
          {it.roles.participated && (
            <button
              style={!isPending ? actionBtn : actionBtnDisabled}
              disabled={isPending}
              onClick={() => callRaffleTx(raffle.id, "function claimTicketRefund()")}
              title="Claim a ticket refund if the contract says you have one"
            >
              {isPending ? "Confirming…" : "Claim ticket refund"}
            </button>
          )}

          {(it.isCreator || it.roles.participated) && (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              If you’re not eligible yet, the transaction will revert — the contract enforces all rules.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{account ? "Your activity" : "Sign in required"}</div>

          <button style={pill} onClick={refetch} disabled={isPending}>
            Refresh
          </button>
        </div>
      </div>

      {note && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>{note}</div>}
      {msg && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>{msg}</div>}

      <div style={section}>
        <div style={{ fontWeight: 800 }}>Your created raffles</div>
        <div style={grid}>
          {!created && <div style={{ opacity: 0.85, fontSize: 13 }}>Loading…</div>}
          {created && created.length === 0 && <div style={{ opacity: 0.85, fontSize: 13 }}>No created raffles yet.</div>}
          {created?.map(renderItem)}
        </div>
      </div>

      <div style={section}>
        <div style={{ fontWeight: 800 }}>Raffles you joined</div>
        <div style={grid}>
          {!joined && <div style={{ opacity: 0.85, fontSize: 13 }}>Loading…</div>}
          {joined && joined.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13 }}>You haven’t joined any raffles yet.</div>
          )}
          {joined?.map(renderItem)}
        </div>
      </div>
    </div>
  );
}