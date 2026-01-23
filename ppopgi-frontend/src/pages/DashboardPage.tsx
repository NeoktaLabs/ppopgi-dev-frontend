// src/pages/DashboardPage.tsx
import React, { useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { RaffleCard } from "../components/RaffleCard";

import { useClaimableRaffles } from "../hooks/useClaimableRaffles";
import { useDashboardData } from "../hooks/useDashboardData"; // ✅ use true dashboard hook

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

function norm(a: string) {
  return (a || "").trim().toLowerCase();
}

// ✅ V2 deployer (exclude everything else = V1)
const V2_DEPLOYER = "0x6050196520e7010Aa39C8671055B674851E2426D";
function isV2Raffle(r: any) {
  return norm(r?.deployer ?? "") === norm(V2_DEPLOYER);
}

// ✅ Minimal ABI so thirdweb can type prepareContractCall
const RAFFLE_MIN_ABI = [
  {
    type: "function",
    name: "withdrawFunds",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawNative",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimTicketRefund",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

type MethodName = "withdrawFunds" | "withdrawNative" | "claimTicketRefund";

export function DashboardPage({ account, onOpenRaffle }: Props) {
  // ✅ True dashboard data
  const dash = useDashboardData(account, 250);

  // ✅ Claimables data (for action buttons only)
  const claim = useClaimableRaffles(account, 250);

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ V2-only dashboard lists
  const created = useMemo(() => {
    const list = dash.created ?? null;
    if (!list) return null;
    return list.filter(isV2Raffle);
  }, [dash.created]);

  const joined = useMemo(() => {
    const list = dash.joined ?? null;
    if (!list) return null;
    return list.filter(isV2Raffle);
  }, [dash.joined]);

  // ✅ V2-only claimables list
  const claimables = useMemo(() => {
    if (!claim.items) return null;
    return claim.items.filter((it: any) => isV2Raffle(it?.raffle));
  }, [claim.items]);

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

      const tx = prepareContractCall({
        contract: raffleContract,
        method,
        params: [] as const,
      });

      await sendAndConfirm(tx);
      setMsg("Done.");
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

    const statusLine = hasUsdc || hasNative ? "You have funds available to claim." : "Nothing to claim right now.";

    return (
      <div key={raffle.id}>
        <RaffleCard raffle={raffle} onOpen={onOpenRaffle} />

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
              onClick={() => callRaffleTx(raffle.id, "withdrawFunds")}
              title="Withdraw your claimable USDC (if available)"
            >
              {isPending ? "Confirming…" : "Withdraw USDC"}
            </button>

            <button
              style={hasNative && !isPending ? actionBtn : actionBtnDisabled}
              disabled={!hasNative || isPending}
              onClick={() => callRaffleTx(raffle.id, "withdrawNative")}
              title="Withdraw your claimable native (if available)"
            >
              {isPending ? "Confirming…" : "Withdraw native"}
            </button>
          </div>

          {it.roles.participated && (
            <button
              style={!isPending ? actionBtn : actionBtnDisabled}
              disabled={isPending}
              onClick={() => callRaffleTx(raffle.id, "claimTicketRefund")}
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

          <button
            style={pill}
            onClick={() => {
              dash.refetch();
              claim.refetch();
            }}
            disabled={isPending}
          >
            Refresh
          </button>
        </div>
      </div>

      {(dash.note || claim.note) && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          {dash.note || claim.note}
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>{msg}</div>}

      {/* ✅ Created */}
      <div style={section}>
        <div style={{ fontWeight: 800 }}>Your created raffles</div>
        <div style={grid}>
          {!created && <div style={{ opacity: 0.85, fontSize: 13 }}>Loading…</div>}
          {created && created.length === 0 && <div style={{ opacity: 0.85, fontSize: 13 }}>No created raffles yet.</div>}
          {created?.map((raffle) => (
            <div key={raffle.id}>
              <RaffleCard raffle={raffle} onOpen={onOpenRaffle} />
            </div>
          ))}
        </div>
      </div>

      {/* ✅ Joined */}
      <div style={section}>
        <div style={{ fontWeight: 800 }}>Raffles you joined</div>
        <div style={grid}>
          {!joined && <div style={{ opacity: 0.85, fontSize: 13 }}>Loading…</div>}
          {joined && joined.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13 }}>You haven’t joined any raffles yet.</div>
          )}
          {joined?.map((raffle) => (
            <div key={raffle.id}>
              <RaffleCard raffle={raffle} onOpen={onOpenRaffle} />
            </div>
          ))}
        </div>
      </div>

      {/* ✅ Claimables (actions live here, separated on purpose) */}
      <div style={section}>
        <div style={{ fontWeight: 800 }}>Claimables</div>
        <div style={grid}>
          {!claimables && <div style={{ opacity: 0.85, fontSize: 13 }}>Loading…</div>}
          {claimables && claimables.length === 0 && (
            <div style={{ opacity: 0.85, fontSize: 13 }}>Nothing to claim right now.</div>
          )}
          {claimables?.map(renderClaimableItem)}
        </div>
      </div>
    </div>
  );
}