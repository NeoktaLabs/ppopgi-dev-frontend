// src/components/CreateRaffleModal.tsx
import React, { useMemo, useState } from "react";
import { parseUnits } from "ethers";
import { ETHERLINK_MAINNET } from "../chain/etherlink";
import { useFactoryConfig } from "../hooks/useFactoryConfig";
import { CONTRACTS } from "../config/contracts";

import { getContract, prepareContractCall } from "thirdweb";
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

function toInt(n: string, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.floor(x) : fallback;
}

export function CreateRaffleModal({ open, onClose }: Props) {
  const { data, loading, note } = useFactoryConfig(open);

  const account = useActiveAccount();
  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // ---------- form state ----------
  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("1"); // USDC
  const [winningPot, setWinningPot] = useState("100"); // USDC
  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState("1000");
  const [durationHours, setDurationHours] = useState("24");
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1"); // tickets per purchase (uint32)

  const [msg, setMsg] = useState<string | null>(null);

  const deployer = useMemo(() => {
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: CONTRACTS.SingleWinnerDeployer,
    });
  }, []);

  const canSubmit =
    !!account?.address &&
    !isPending &&
    name.trim().length > 0 &&
    toInt(minTickets, 0) > 0 &&
    toInt(maxTickets, 0) >= toInt(minTickets, 0) &&
    toInt(durationHours, 0) > 0 &&
    toInt(minPurchaseAmount, 0) > 0;

  async function onCreate() {
    setMsg(null);

    if (!account?.address) {
      setMsg("Please sign in first.");
      return;
    }

    try {
      // amounts are in USDC (6 decimals)
      const ticketPriceU = parseUnits(ticketPrice || "0", 6);
      const winningPotU = parseUnits(winningPot || "0", 6);

      const minT = BigInt(toInt(minTickets, 0));
      const maxT = BigInt(toInt(maxTickets, 0));
      const durationSeconds = BigInt(toInt(durationHours, 0) * 3600);
      const minPurchase = BigInt(toInt(minPurchaseAmount, 0));

      const tx = prepareContractCall({
        contract: deployer,
        method:
          "function createSingleWinnerLottery(string name,uint256 ticketPrice,uint256 winningPot,uint64 minTickets,uint64 maxTickets,uint64 durationSeconds,uint32 minPurchaseAmount) returns (address lotteryAddr)",
        params: [
          name.trim(),
          ticketPriceU,
          winningPotU,
          minT,
          maxT,
          durationSeconds,
          minPurchase,
        ],
      });

      await sendAndConfirm(tx);

      setMsg("Raffle created successfully.");
      // optional: close immediately
      onClose();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.toLowerCase().includes("user rejected") || m.toLowerCase().includes("rejected")) {
        setMsg("Transaction canceled.");
      } else {
        setMsg("Could not create the raffle. Please try again.");
      }
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
    zIndex: 10500,
  };

  const card: React.CSSProperties = {
    width: "min(640px, 100%)",
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

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.35)",
    borderRadius: 12,
    padding: "10px 10px",
    outline: "none",
    color: "#2B2B33",
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  };

  const btn: React.CSSProperties = {
    width: "100%",
    marginTop: 12,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.24)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: canSubmit ? "pointer" : "not-allowed",
    opacity: canSubmit ? 1 : 0.6,
    color: "#2B2B33",
    fontWeight: 800,
    textAlign: "center",
  };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Create</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Create a raffle</div>
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
          This raffle booth runs on <b>{ETHERLINK_MAINNET.chainName}</b>.
        </div>

        {/* Live factory config */}
        <div style={section}>
          <div style={{ fontWeight: 800 }}>Create settings (live)</div>

          {loading && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>Loading create settings…</div>
          )}

          {note && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>{note}</div>
          )}

          <div style={row}>
            <div style={label}>Ppopgi fee</div>
            <div style={{ fontWeight: 700 }}>{data ? `${data.protocolFeePercent}%` : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>Fee receiver</div>
            <div style={{ fontWeight: 700 }}>{data ? short(data.feeRecipient) : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>USDC</div>
            <div style={{ fontWeight: 700 }}>{data ? short(data.usdc) : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>Randomness provider</div>
            <div style={{ fontWeight: 700 }}>{data ? short(data.entropyProvider) : "—"}</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            These settings are set on the network and can’t be changed by the app.
          </div>
        </div>

        {/* Form */}
        <div style={section}>
          <div style={{ fontWeight: 800 }}>Raffle details</div>

          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Name</div>
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ppopgi #12" />

          <div style={grid2}>
            <div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Ticket price (USDC)</div>
              <input style={input} value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} />
            </div>
            <div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Winning pot (USDC)</div>
              <input style={input} value={winningPot} onChange={(e) => setWinningPot(e.target.value)} />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Min tickets</div>
              <input style={input} value={minTickets} onChange={(e) => setMinTickets(e.target.value)} />
            </div>
            <div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Max tickets</div>
              <input style={input} value={maxTickets} onChange={(e) => setMaxTickets(e.target.value)} />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Duration (hours)</div>
              <input style={input} value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
            </div>
            <div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>Min purchase (tickets)</div>
              <input
                style={input}
                value={minPurchaseAmount}
                onChange={(e) => setMinPurchaseAmount(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            You will confirm the transaction in your wallet. Nothing happens automatically.
          </div>

          <button style={btn} disabled={!canSubmit} onClick={onCreate}>
            {isPending ? "Creating…" : account?.address ? "Create raffle" : "Sign in to create"}
          </button>

          {msg && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              {msg}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          Nothing happens automatically. You always confirm actions yourself.
        </div>
      </div>
    </div>
  );
}