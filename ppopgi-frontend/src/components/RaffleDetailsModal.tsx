// src/components/RaffleDetailsModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { useRaffleDetails } from "../hooks/useRaffleDetails";
import { SafetyProofModal } from "./SafetyProofModal";

import { getContract, prepareContractCall, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";

import { ADDRESSES } from "../config/contracts";

type Props = {
  open: boolean;
  raffleId: string | null;
  onClose: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function statusLabel(s: string) {
  if (s === "FUNDING_PENDING") return "Getting ready";
  if (s === "OPEN") return "Open";
  if (s === "DRAWING") return "Drawing";
  if (s === "COMPLETED") return "Settled";
  if (s === "CANCELED") return "Canceled";
  return "Unknown";
}

function formatTime(seconds: string) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  return new Date(n * 1000).toLocaleString();
}

function fmtUsdc(raw: string) {
  try {
    return formatUnits(BigInt(raw), 6);
  } catch {
    return "0";
  }
}

function toInt(v: string, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function RaffleDetailsModal({ open, raffleId, onClose }: Props) {
  const { data, loading, note } = useRaffleDetails(raffleId, open);
  const [safetyOpen, setSafetyOpen] = useState(false);

  // ✅ thirdweb is the source of truth
  const activeAccount = useActiveAccount();
  const isConnected = !!activeAccount?.address;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // --- Buy tickets UI state
  const [tickets, setTickets] = useState("1");
  const [buyMsg, setBuyMsg] = useState<string | null>(null);

  // --- Allowance/balance
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  const canShowWinner = useMemo(() => data?.status === "COMPLETED", [data?.status]);

  // Contracts (thirdweb)
  const raffleContract = useMemo(() => {
    if (!raffleId) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: raffleId,
    });
  }, [raffleId]);

  const usdcContract = useMemo(() => {
    // Prefer the raffle’s live USDC if present; fallback to config
    const addr = data?.usdcToken || ADDRESSES.USDC;
    if (!addr) return null;

    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: addr,
    });
  }, [data?.usdcToken]);

  // Reset ticket input + messages when opening a new raffle
  useEffect(() => {
    if (!open) return;
    setTickets("1");
    setBuyMsg(null);
  }, [open, raffleId]);

  // --- compute purchase cost
  const ticketCount = Math.max(0, toInt(tickets, 0));
  const ticketPriceU = data ? BigInt(data.ticketPrice) : 0n;
  const totalCostU = BigInt(ticketCount) * ticketPriceU;

  async function refreshAllowance() {
    if (!open) return;
    if (!activeAccount?.address) return;
    if (!usdcContract) return;
    if (!raffleId) return;

    setAllowLoading(true);
    try {
      const [bal, a] = await Promise.all([
        readContract({
          contract: usdcContract,
          method: "function balanceOf(address) view returns (uint256)",
          params: [activeAccount.address],
        }),
        readContract({
          contract: usdcContract,
          method: "function allowance(address,address) view returns (uint256)",
          params: [activeAccount.address, raffleId],
        }),
      ]);

      setUsdcBal(BigInt(bal as any));
      setAllowance(BigInt(a as any));
    } catch {
      setUsdcBal(null);
      setAllowance(null);
    } finally {
      setAllowLoading(false);
    }
  }

  // Load USDC balance + allowance when open + account + raffle loaded
  useEffect(() => {
    if (!open) return;
    if (!activeAccount?.address) return;
    refreshAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeAccount?.address, raffleId, data?.usdcToken]);

  // Optional but helpful: if ticket count changes, allowance requirements change too
  useEffect(() => {
    if (!open) return;
    if (!activeAccount?.address) return;
    // no spam — just recompute UI from existing allowance/bal; refresh not required
    // but we keep this hook in case you want to uncomment a refresh later
  }, [open, activeAccount?.address, ticketCount]);

  if (!open) return null;

  const hasEnoughAllowance = allowance !== null ? allowance >= totalCostU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= totalCostU : true; // if unknown, don’t block

  const canBuy =
    isConnected &&
    !!data &&
    data.status === "OPEN" &&
    !data.paused &&
    ticketCount > 0 &&
    totalCostU > 0n &&
    hasEnoughAllowance &&
    hasEnoughBalance &&
    !isPending;

  const needsAllow =
    isConnected &&
    !!data &&
    data.status === "OPEN" &&
    !data.paused &&
    ticketCount > 0 &&
    totalCostU > 0n &&
    !hasEnoughAllowance &&
    !isPending;

  async function onAllow() {
    setBuyMsg(null);

    if (!activeAccount?.address) {
      setBuyMsg("Please sign in first.");
      return;
    }
    if (!data || !raffleId || !usdcContract) {
      setBuyMsg("Could not prepare this step. Please try again.");
      return;
    }
    if (totalCostU <= 0n) {
      setBuyMsg("Choose how many tickets you want first.");
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender,uint256 amount) returns (bool)",
        params: [raffleId, totalCostU],
      });

      await sendAndConfirm(tx);
      setBuyMsg("Coins allowed. You can now buy tickets.");
      await refreshAllowance();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) setBuyMsg("Action canceled.");
      else setBuyMsg("Could not allow coins right now. Please try again.");
    }
  }

  async function onBuy() {
    setBuyMsg(null);

    if (!activeAccount?.address) {
      setBuyMsg("Please sign in first.");
      return;
    }
    if (!data || !raffleContract) {
      setBuyMsg("Could not prepare this purchase. Please try again.");
      return;
    }
    if (data.status !== "OPEN") {
      setBuyMsg("This raffle is not open right now.");
      return;
    }
    if (data.paused) {
      setBuyMsg("This raffle is paused right now.");
      return;
    }
    if (ticketCount <= 0) {
      setBuyMsg("Choose at least 1 ticket.");
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: raffleContract,
        method: "function buy(uint64 amount)",
        params: [BigInt(ticketCount)],
      });

      await sendAndConfirm(tx);

      setBuyMsg("You’re in. Tickets purchased.");
      await refreshAllowance();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) {
        setBuyMsg("Purchase canceled.");
      } else if (m.toLowerCase().includes("insufficient")) {
        setBuyMsg("Not enough coins (USDC) to complete this.");
      } else {
        setBuyMsg("Could not buy tickets. Please try again.");
      }
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const card: React.CSSProperties = {
    width: "min(560px, 100%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.22)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
    padding: 18,
    color: "#2B2B33",
  };

  const section: React.CSSProperties = {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 6,
  };

  const label: React.CSSProperties = { opacity: 0.85 };
  const value: React.CSSProperties = { fontWeight: 700 };

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.35)",
    borderRadius: 12,
    padding: "10px 10px",
    outline: "none",
    color: "#2B2B33",
  };

  const btn: React.CSSProperties = {
    width: "100%",
    marginTop: 10,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.24)",
    borderRadius: 14,
    padding: "12px 12px",
    color: "#2B2B33",
    fontWeight: 800,
    textAlign: "center",
  };

  const btnDisabled: React.CSSProperties = {
    ...btn,
    cursor: "not-allowed",
    opacity: 0.6,
  };

  const btnEnabled: React.CSSProperties = {
    ...btn,
    cursor: "pointer",
    opacity: 1,
  };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Raffle</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{data?.name ?? "Loading…"}</div>
            {raffleId ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>{raffleId}</div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => data && setSafetyOpen(true)}
              disabled={!data}
              style={{
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.25)",
                borderRadius: 12,
                padding: "8px 10px",
                cursor: data ? "pointer" : "not-allowed",
                opacity: data ? 1 : 0.55,
              }}
            >
              Safety info
            </button>

            <button
              onClick={onClose}
              style={{
                border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.25)",
                borderRadius: 12,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            Loading live details…
          </div>
        )}
        {note && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            {note}
          </div>
        )}

        {data && (
          <>
            <div style={section}>
              <div style={{ fontWeight: 800 }}>Status</div>
              <div style={row}>
                <div style={label}>State</div>
                <div style={value}>{statusLabel(data.status)}</div>
              </div>
              <div style={row}>
                <div style={label}>Ends at</div>
                <div style={value}>{formatTime(data.deadline)}</div>
              </div>
              <div style={row}>
                <div style={label}>Joined</div>
                <div style={value}>
                  {data.sold}
                  {data.maxTickets !== "0" ? ` / ${data.maxTickets}` : ""}
                </div>
              </div>
              {data.paused && (
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                  This raffle is paused right now.
                </div>
              )}
            </div>

            <div style={section}>
              <div style={{ fontWeight: 800 }}>Costs</div>
              <div style={row}>
                <div style={label}>Ticket</div>
                <div style={value}>{fmtUsdc(data.ticketPrice)} USDC</div>
              </div>
              <div style={row}>
                <div style={label}>Win</div>
                <div style={value}>{fmtUsdc(data.winningPot)} USDC</div>
              </div>
              <div style={row}>
                <div style={label}>Ppopgi fee</div>
                <div style={value}>{data.protocolFeePercent}%</div>
              </div>
              <div style={row}>
                <div style={label}>Fee receiver</div>
                <div style={value}>{short(data.feeRecipient)}</div>
              </div>
            </div>

            {/* --- BUY TICKETS --- */}
            <div style={section}>
              <div style={{ fontWeight: 800 }}>Join</div>

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>How many tickets</div>
              <input
                style={input}
                value={tickets}
                onChange={(e) => setTickets(e.target.value)}
                placeholder="e.g. 3"
              />

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
                Total cost: <b>{fmtUsdc(totalCostU.toString())} USDC</b>
              </div>

              {isConnected ? (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  {allowLoading ? (
                    "Checking coins…"
                  ) : (
                    <>
                      {usdcBal !== null ? `Your coins: ${fmtUsdc(usdcBal.toString())} USDC • ` : ""}
                      {allowance !== null
                        ? `Allowed for this raffle: ${fmtUsdc(allowance.toString())} USDC`
                        : ""}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Please sign in to join.</div>
              )}

              <button style={needsAllow ? btnEnabled : btnDisabled} disabled={!needsAllow} onClick={onAllow}>
                {isPending ? "Confirming…" : isConnected ? "Allow coins (USDC)" : "Sign in to allow"}
              </button>

              <button style={canBuy ? btnEnabled : btnDisabled} disabled={!canBuy} onClick={onBuy}>
                {isPending ? "Confirming…" : isConnected ? "Buy tickets" : "Sign in to join"}
              </button>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                Nothing happens automatically. You always confirm actions yourself.
              </div>

              {buyMsg && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>{buyMsg}</div>}
            </div>

            {/* Winner */}
            {canShowWinner ? (
              <div style={section}>
                <div style={{ fontWeight: 800 }}>Winner</div>
                <div style={row}>
                  <div style={label}>Winning account</div>
                  <div style={value}>{short(data.winner)}</div>
                </div>
                <div style={row}>
                  <div style={label}>Winning ticket</div>
                  <div style={value}>{data.winningTicketIndex}</div>
                </div>
                <div style={row}>
                  <div style={label}>Prize</div>
                  <div style={value}>{fmtUsdc(data.winningPot)} USDC</div>
                </div>
              </div>
            ) : (
              <div style={section}>
                <div style={{ fontWeight: 800 }}>Winner</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                  The winner is shown only after the raffle is settled.
                </div>
              </div>
            )}
          </>
        )}

        {data && (
          <SafetyProofModal open={safetyOpen} onClose={() => setSafetyOpen(false)} raffle={data} />
        )}
      </div>
    </div>
  );
}