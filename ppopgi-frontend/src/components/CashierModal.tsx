// src/components/CashierModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { getContract, prepareContractCall } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

import { RaffleCard } from "./RaffleCard";
import { useCashierRaffles } from "../hooks/useCashierRaffles";

type Props = {
  open: boolean;
  onClose: () => void;

  // optional: lets cashier open the same raffle details modal
  onOpenRaffle?: (id: string) => void;
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

export function CashierModal({ open, onClose, onOpenRaffle }: Props) {
  const activeAccount = useActiveAccount();
  const me = activeAccount?.address ?? null;

  const { items, note, refetch } = useCashierRaffles(me, 200);

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
  }, [open]);

  const overlay: React.CSSProperties = useMemo(
    () => ({
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 12000,
    }),
    []
  );

  const card: React.CSSProperties = useMemo(
    () => ({
      width: "min(820px, 100%)",
      maxHeight: "min(78vh, 900px)",
      overflow: "auto",
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.35)",
      background: "rgba(255,255,255,0.22)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
      padding: 18,
      color: "#2B2B33",
    }),
    []
  );

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

  async function callRaffleTx(raffleId: string, method: string) {
    setMsg(null);
    if (!me) {
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

  if (!open) return null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Cashier</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Your claims & withdrawals</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              Everything here comes from the network. The app can’t change it.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={pill} onClick={refetch} disabled={isPending}>
              Refresh
            </button>
            <button style={pill} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {note && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>{note}</div>}

        {msg && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>{msg}</div>}

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {!items && <div style={{ opacity: 0.85 }}>Loading your raffles…</div>}

          {items && items.length === 0 && (
            <div style={{ opacity: 0.85 }}>Nothing to claim yet.</div>
          )}

          {items?.map((it) => {
            const raffle = it.raffle;

            const hasUsdc = BigInt(it.claimableUsdc || "0") > 0n;
            const hasNative = BigInt(it.claimableNative || "0") > 0n;

            // Show creator withdraw buttons even if claimable is 0 — contract may gate it anyway
            const showCreator = it.isCreator;

            return (
              <div key={raffle.id}>
                <RaffleCard
                  raffle={raffle}
                  onOpen={(id) => {
                    if (onOpenRaffle) onOpenRaffle(id);
                  }}
                />

                {/* Actions footer */}
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

                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    Claimable USDC: <b>{fmtUsdc(it.claimableUsdc)} USDC</b> •{" "}
                    Claimable native: <b>{fmtNative(it.claimableNative)} </b>
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

                  {/* Refund path (participants) */}
                  <button
                    style={!isPending ? actionBtn : actionBtnDisabled}
                    disabled={isPending}
                    onClick={() => callRaffleTx(raffle.id, "function claimTicketRefund()")}
                    title="Claim a ticket refund if the contract says you have one"
                  >
                    {isPending ? "Confirming…" : "Claim ticket refund"}
                  </button>

                  {/* Creator-only options */}
                  {showCreator && (
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      Creator actions are protected by the contract. If you’re not eligible yet, the transaction will revert.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}