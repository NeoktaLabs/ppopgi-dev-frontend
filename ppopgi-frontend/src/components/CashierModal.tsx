// src/components/CashierModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits, getAddress } from "ethers";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUsdc(raw: bigint | null) {
  if (raw === null) return "—";
  try {
    return formatUnits(raw, 6);
  } catch {
    return "0";
  }
}

function fmtNative(raw: bigint | null) {
  if (raw === null) return "—";
  try {
    return formatUnits(raw, 18);
  } catch {
    return "0";
  }
}

export function CashierModal({ open, onClose }: Props) {
  const activeAccount = useActiveAccount();
  const isConnected = !!activeAccount?.address;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  const [raffleInput, setRaffleInput] = useState("");
  const [raffleAddr, setRaffleAddr] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [claimableUsdc, setClaimableUsdc] = useState<bigint | null>(null);
  const [claimableNative, setClaimableNative] = useState<bigint | null>(null);

  // normalize address when user types/pastes
  useEffect(() => {
    if (!open) return;

    setMsg(null);
    setClaimableUsdc(null);
    setClaimableNative(null);

    const v = raffleInput.trim();
    if (!v) {
      setRaffleAddr(null);
      return;
    }

    try {
      setRaffleAddr(getAddress(v));
    } catch {
      setRaffleAddr(null);
    }
  }, [open, raffleInput]);

  const raffleContract = useMemo(() => {
    if (!raffleAddr) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: raffleAddr,
    });
  }, [raffleAddr]);

  async function refresh() {
    setMsg(null);

    if (!open) return;
    if (!isConnected || !activeAccount?.address) {
      setClaimableUsdc(null);
      setClaimableNative(null);
      return;
    }
    if (!raffleContract) {
      setClaimableUsdc(null);
      setClaimableNative(null);
      return;
    }

    setLoading(true);
    try {
      const [u, n] = await Promise.all([
        readContract({
          contract: raffleContract,
          method: "function claimableFunds(address) view returns (uint256)",
          params: [activeAccount.address],
        }),
        readContract({
          contract: raffleContract,
          method: "function claimableNative(address) view returns (uint256)",
          params: [activeAccount.address],
        }),
      ]);

      setClaimableUsdc(BigInt(u as any));
      setClaimableNative(BigInt(n as any));
    } catch {
      setClaimableUsdc(null);
      setClaimableNative(null);
      setMsg("Could not read claimable amounts for this raffle. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  }

  // auto refresh when modal opens & address becomes valid
  useEffect(() => {
    if (!open) return;
    if (!raffleContract) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, raffleAddr, activeAccount?.address]);

  async function onWithdrawUsdc() {
    setMsg(null);

    if (!isConnected || !activeAccount?.address) {
      setMsg("Please sign in first.");
      return;
    }
    if (!raffleContract || !raffleAddr) {
      setMsg("Paste a valid raffle address first.");
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: raffleContract,
        method: "function withdrawFunds()",
        params: [],
      });

      await sendAndConfirm(tx);
      setMsg("Withdrawal sent. Your wallet confirmed it.");
      await refresh();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not withdraw USDC right now. Please try again.");
    }
  }

  async function onWithdrawNative() {
    setMsg(null);

    if (!isConnected || !activeAccount?.address) {
      setMsg("Please sign in first.");
      return;
    }
    if (!raffleContract || !raffleAddr) {
      setMsg("Paste a valid raffle address first.");
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: raffleContract,
        method: "function withdrawNative()",
        params: [],
      });

      await sendAndConfirm(tx);
      setMsg("Withdrawal sent. Your wallet confirmed it.");
      await refresh();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not withdraw native right now. Please try again.");
    }
  }

  if (!open) return null;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 11000,
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
  const value: React.CSSProperties = { fontWeight: 800 };

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

  const canWithdrawUsdc = isConnected && !!raffleAddr && !isPending && (claimableUsdc ?? 0n) > 0n;
  const canWithdrawNative = isConnected && !!raffleAddr && !isPending && (claimableNative ?? 0n) > 0n;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Cashier</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Withdraw funds</div>
          </div>

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

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          Paste a raffle address to check what you can withdraw. Nothing happens automatically.
        </div>

        <div style={section}>
          <div style={{ fontWeight: 900 }}>Raffle address</div>

          <div style={{ marginTop: 8 }}>
            <input
              style={input}
              value={raffleInput}
              onChange={(e) => setRaffleInput(e.target.value)}
              placeholder="0x…"
            />
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
            {raffleAddr ? (
              <>Detected: <b>{short(raffleAddr)}</b></>
            ) : raffleInput.trim() ? (
              <>Not a valid address yet.</>
            ) : (
              <>Tip: use any raffle address from Home or Explore.</>
            )}
          </div>

          <button
            style={isConnected && raffleAddr && !loading ? btnEnabled : btnDisabled}
            disabled={!isConnected || !raffleAddr || loading}
            onClick={refresh}
          >
            {loading ? "Checking…" : isConnected ? "Check claimable amounts" : "Sign in to check"}
          </button>
        </div>

        <div style={section}>
          <div style={{ fontWeight: 900 }}>Claimable</div>

          <div style={row}>
            <div style={label}>USDC</div>
            <div style={value}>{fmtUsdc(claimableUsdc)} USDC</div>
          </div>

          <div style={row}>
            <div style={label}>Native</div>
            <div style={value}>{fmtNative(claimableNative)}</div>
          </div>

          <button
            style={canWithdrawUsdc ? btnEnabled : btnDisabled}
            disabled={!canWithdrawUsdc}
            onClick={onWithdrawUsdc}
          >
            {isPending ? "Confirming…" : isConnected ? "Withdraw USDC" : "Sign in to withdraw"}
          </button>

          <button
            style={canWithdrawNative ? btnEnabled : btnDisabled}
            disabled={!canWithdrawNative}
            onClick={onWithdrawNative}
          >
            {isPending ? "Confirming…" : isConnected ? "Withdraw native" : "Sign in to withdraw"}
          </button>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            Withdrawals are on-chain transactions and must be confirmed in your wallet.
          </div>

          {msg && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}