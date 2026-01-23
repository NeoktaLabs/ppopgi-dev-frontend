// src/components/CreateRaffleModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, Interface } from "ethers";
import { ETHERLINK_MAINNET } from "../chain/etherlink";
import { useFactoryConfig } from "../hooks/useFactoryConfig";
import { ADDRESSES } from "../config/contracts";

import { getContract, prepareContractCall, readContract } from "thirdweb";
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

import { RaffleCard } from "../components/RaffleCard";
import type { RaffleListItem } from "../indexer/subgraph";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type DurationUnit = "minutes" | "hours" | "days";
function unitToSeconds(unit: DurationUnit): number {
  if (unit === "minutes") return 60;
  if (unit === "hours") return 3600;
  return 86400;
}

function sanitizeIntInput(raw: string) {
  return raw.replace(/[^\d]/g, "");
}
function toIntStrict(raw: string, fallback = 0) {
  const s = sanitizeIntInput(raw);
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function fmtUsdc(raw: bigint) {
  try {
    return formatUnits(raw, 6);
  } catch {
    return "0";
  }
}

function isHexAddress(a: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(a);
}

const DEPLOYER_EVENT_ABI = [
  "event LotteryDeployed(address indexed lottery,address indexed creator,uint256 winningPot,uint256 ticketPrice,string name,address usdc,address entropy,address entropyProvider,uint32 callbackGasLimit,address feeRecipient,uint256 protocolFeePercent,uint64 deadline,uint64 minTickets,uint64 maxTickets)",
];

export function CreateRaffleModal({ open, onClose, onCreated }: Props) {
  const { data, loading, note } = useFactoryConfig(open);

  const account = useActiveAccount();
  const me = account?.address ?? null;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // ---------- form state ----------
  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("1"); // integers only
  const [winningPot, setWinningPot] = useState("100"); // integers only

  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); // empty = unlimited
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  const [msg, setMsg] = useState<string | null>(null);
  const [createdRaffleId, setCreatedRaffleId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Allowance/balance state ---
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  // Optional: hide confusing numbers behind a “Details” toggle
  const [showDetails, setShowDetails] = useState(false);

  const deployer = useMemo(
    () =>
      getContract({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: ADDRESSES.SingleWinnerDeployer,
      }),
    []
  );

  const usdcContract = useMemo(() => {
    const addr = data?.usdc || ADDRESSES.USDC;
    if (!addr) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: addr,
    });
  }, [data?.usdc]);

  // ---- parse + validate ----
  const durV = toIntStrict(durationValue, 0);
  const durationSecondsN = durV * unitToSeconds(durationUnit);

  const MIN_DURATION_SECONDS = 5 * 60;
  const MAX_DURATION_SECONDS = 30 * 24 * 3600;
  const durOk = durationSecondsN >= MIN_DURATION_SECONDS && durationSecondsN <= MAX_DURATION_SECONDS;

  const minTn = toIntStrict(minTickets, 1);
  const maxTnRaw = toIntStrict(maxTickets, 0);
  const maxTn = maxTickets.trim() === "" ? 0 : maxTnRaw; // 0 = unlimited
  const minPurchase = toIntStrict(minPurchaseAmount, 1);

  const minT = BigInt(Math.max(1, minTn));
  const maxT = BigInt(Math.max(0, maxTn));
  const minPurchaseU32 = Math.max(1, minPurchase);

  const maxTicketsIsUnlimited = maxTickets.trim() === "" || maxTn === 0;
  const ticketsOk = maxTicketsIsUnlimited ? true : maxT >= minT;
  const minPurchaseOk = maxTicketsIsUnlimited ? true : BigInt(minPurchaseU32) <= maxT;

  const ticketPriceU = useMemo(() => {
    try {
      const clean = sanitizeIntInput(ticketPrice || "0");
      return parseUnits(clean || "0", 6);
    } catch {
      return 0n;
    }
  }, [ticketPrice]);

  const winningPotU = useMemo(() => {
    try {
      const clean = sanitizeIntInput(winningPot || "0");
      return parseUnits(clean || "0", 6);
    } catch {
      return 0n;
    }
  }, [winningPot]);

  const requiredAllowanceU = winningPotU;

  const hasEnoughAllowance = allowance !== null ? allowance >= requiredAllowanceU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= requiredAllowanceU : true;

  const durationHint = useMemo(() => {
    if (!durV) return "Choose a duration.";
    if (durationSecondsN < MIN_DURATION_SECONDS) return "Minimum is 5 minutes.";
    if (durationSecondsN > MAX_DURATION_SECONDS) return "Maximum is 30 days.";
    const end = new Date(Date.now() + durationSecondsN * 1000);
    return `Ends at: ${end.toLocaleString()}`;
  }, [durV, durationSecondsN]);

  const canSubmit =
    !!me &&
    !isPending &&
    name.trim().length > 0 &&
    durOk &&
    ticketsOk &&
    minPurchaseOk &&
    requiredAllowanceU > 0n &&
    hasEnoughAllowance &&
    hasEnoughBalance;

  const needsAllow = !!me && !isPending && !!usdcContract && requiredAllowanceU > 0n && !hasEnoughAllowance;

  async function refreshAllowance() {
    if (!open) return;
    if (!me) return;
    if (!usdcContract) return;

    setAllowLoading(true);
    try {
      const [bal, a] = await Promise.all([
        readContract({
          contract: usdcContract,
          method: "function balanceOf(address) view returns (uint256)",
          params: [me],
        }),
        readContract({
          contract: usdcContract,
          method: "function allowance(address,address) view returns (uint256)",
          params: [me, ADDRESSES.SingleWinnerDeployer],
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

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setCreatedRaffleId(null);
    setCopied(false);
    setShowDetails(false);
    setAdvancedOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!me) return;
    refreshAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, me, usdcContract?.address]);

  async function onEnablePrizeDeposit() {
    setMsg(null);
    if (!me) return setMsg("Please sign in first.");
    if (!usdcContract) return setMsg("USDC contract not available right now.");
    if (requiredAllowanceU <= 0n) return setMsg("Enter a winning pot first.");

    try {
      // Approve exactly the pot amount (simple + least confusing)
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender,uint256 amount) returns (bool)",
        params: [ADDRESSES.SingleWinnerDeployer, requiredAllowanceU],
      });

      await sendAndConfirm(tx);
      await refreshAllowance();
      setMsg("✅ Prize deposit is ready. You can launch your raffle.");
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not set permission right now. Please try again.");
    }
  }

  function extractCreatedRaffleAddress(receiptLike: any): string | null {
    try {
      const receipt = receiptLike?.receipt ?? receiptLike;
      const logs = receipt?.logs ?? receipt?.transactionReceipt?.logs ?? [];
      if (!Array.isArray(logs) || logs.length === 0) return null;

      const iface = new Interface(DEPLOYER_EVENT_ABI);
      const event = iface.getEvent("LotteryDeployed");
      const topic0 = (event as any).topicHash;

      for (const log of logs) {
        const addr = String(log?.address || "").toLowerCase();
        if (addr !== String(ADDRESSES.SingleWinnerDeployer).toLowerCase()) continue;

        const topics = log?.topics;
        if (!topics?.length) continue;
        if (String(topics[0]).toLowerCase() !== String(topic0).toLowerCase()) continue;

        const parsed = iface.parseLog({ topics, data: log.data });
        const lotteryAddr = String(parsed?.args?.lottery ?? parsed?.args?.[0] ?? "");
        if (isHexAddress(lotteryAddr)) return lotteryAddr;
      }

      return null;
    } catch {
      return null;
    }
  }

  async function onLaunchRaffle() {
    setMsg(null);

    if (!me) return setMsg("Please sign in first.");
    if (!durOk) return setMsg("Duration must be between 5 minutes and 30 days.");
    if (!ticketsOk) return setMsg("Max tickets must be ≥ min tickets (or leave max empty for unlimited).");
    if (!minPurchaseOk) return setMsg("Min purchase must be ≤ max tickets (or keep max unlimited).");
    if (requiredAllowanceU <= 0n) return setMsg("Winning pot must be greater than 0.");
    if (!hasEnoughBalance) return setMsg("Not enough USDC for the winning pot deposit.");
    if (!hasEnoughAllowance) return setMsg("Step 1 is required: set prize deposit permission.");

    try {
      const durationSeconds = BigInt(durationSecondsN);

      const tx = prepareContractCall({
        contract: deployer,
        method:
          "function createSingleWinnerLottery(string name,uint256 ticketPrice,uint256 winningPot,uint64 minTickets,uint64 maxTickets,uint64 durationSeconds,uint32 minPurchaseAmount) returns (address lotteryAddr)",
        params: [name.trim(), ticketPriceU, winningPotU, minT, maxT, durationSeconds, minPurchaseU32],
      });

      const res = await sendAndConfirm(tx);

      const created = extractCreatedRaffleAddress(res);
      if (created) {
        setCreatedRaffleId(created);
        setMsg("🎉 Your raffle is live! Share it with your friends.");
      } else {
        setMsg("🎉 Your raffle is live! (Couldn’t auto-detect the address.)");
      }

      try {
        onCreated?.();
      } catch {}
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Transaction canceled.");
      else setMsg(m || "Could not create the raffle. Please try again.");
    }
  }

  async function onCopyShareLink() {
    if (!createdRaffleId) return;
    const url = `${window.location.origin}/raffle/${createdRaffleId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const previewRaffle: RaffleListItem = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = durOk ? String(now + durationSecondsN) : String(now + 3600);

    const tp = sanitizeIntInput(ticketPrice || "0") || "0";
    const wp = sanitizeIntInput(winningPot || "0") || "0";

    const ticketPriceRaw = (() => {
      try {
        return String(parseUnits(tp, 6));
      } catch {
        return "0";
      }
    })();

    const winningPotRaw = (() => {
      try {
        return String(parseUnits(wp, 6));
      } catch {
        return "0";
      }
    })();

    const maxTicketsPreview = maxTickets.trim() === "" ? "0" : String(toIntStrict(maxTickets, 0));

    return {
      id: createdRaffleId || "0x0000000000000000000000000000000000000000",
      name: name.trim() || "Your raffle name…",
      status: "OPEN",
      winningPot: winningPotRaw,
      ticketPrice: ticketPriceRaw,
      deadline,
      sold: "0",
      maxTickets: maxTicketsPreview,
      protocolFeePercent: String(data?.protocolFeePercent ?? "0"),
      feeRecipient: String(data?.feeRecipient ?? "0x0000000000000000000000000000000000000000"),
      deployer: ADDRESSES.SingleWinnerDeployer,
      lastUpdatedTimestamp: String(now),
      creator: me || "0x0000000000000000000000000000000000000000",
    } as any;
  }, [
    name,
    ticketPrice,
    winningPot,
    maxTickets,
    durOk,
    durationSecondsN,
    createdRaffleId,
    me,
    data?.protocolFeePercent,
    data?.feeRecipient,
  ]);

  const shareUrl = createdRaffleId ? `${window.location.origin}/raffle/${createdRaffleId}` : null;

  if (!open) return null;

  const isNarrow = typeof window !== "undefined" ? window.innerWidth < 900 : false;

  // --------- CLEAN WHITE UI STYLES ----------
  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const modal: React.CSSProperties = {
    width: "min(1020px, 100%)",
    maxHeight: "calc(100vh - 32px)",
    background: "#FFFFFF",
    color: "#0F172A",
    borderRadius: 20,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const header: React.CSSProperties = {
    padding: "16px 18px",
    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  };

  const title: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 1000,
    letterSpacing: -0.2,
    margin: 0,
  };

  const subtitle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.70)",
    lineHeight: 1.35,
  };

  const tag: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(2, 6, 23, 0.04)",
    border: "1px solid rgba(2, 6, 23, 0.08)",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(15, 23, 42, 0.80)",
    width: "fit-content",
  };

  const closeBtn: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(15, 23, 42, 0.04)",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
    color: "#0F172A",
    whiteSpace: "nowrap",
  };

  const body: React.CSSProperties = {
    padding: 18,
    overflowY: "auto",
  };

  const layout: React.CSSProperties = isNarrow
    ? { display: "grid", gridTemplateColumns: "1fr", gap: 14 }
    : { display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 14 };

  const panel: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(15, 23, 42, 0.02)",
    padding: 14,
  };

  const panelTitleRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  };

  const panelTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 14,
    fontWeight: 1000,
    letterSpacing: -0.1,
  };

  const panelHint: React.CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.65)",
  };

  const label: React.CSSProperties = {
    marginTop: 12,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(15, 23, 42, 0.80)",
  };

  const input: React.CSSProperties = {
    marginTop: 8,
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "#FFFFFF",
    padding: "11px 12px",
    outline: "none",
    fontWeight: 850,
    color: "#0F172A",
  };

  const select: React.CSSProperties = {
    ...input,
    cursor: "pointer",
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  };

  const grid3: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr 1fr",
    gap: 10,
    marginTop: 10,
  };

  const steps: React.CSSProperties = {
    marginTop: 12,
    display: "grid",
    gap: 10,
  };

  const btnBase: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 1000,
    border: "1px solid rgba(15, 23, 42, 0.12)",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    background: "#0F172A",
    color: "#FFFFFF",
    border: "1px solid rgba(15, 23, 42, 0.12)",
  };

  const btnSoft: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    background: "rgba(15, 23, 42, 0.05)",
    color: "#0F172A",
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    cursor: "not-allowed",
    opacity: 0.55,
    background: "rgba(15, 23, 42, 0.04)",
    color: "rgba(15, 23, 42, 0.70)",
  };

  const statusRow: React.CSSProperties = {
    marginTop: 12,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  };

  const statusChip: React.CSSProperties = {
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "#FFFFFF",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(15, 23, 42, 0.78)",
  };

  const previewWrap: React.CSSProperties = isNarrow
    ? {}
    : { position: "sticky", top: 12, alignSelf: "start" };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={header}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={tag}>Network: {ETHERLINK_MAINNET.chainName}</div>
            <h2 style={title}>Create a raffle</h2>
            <div style={subtitle}>
              Two quick steps. You’ll confirm everything in your wallet.
            </div>
          </div>

          <button onClick={onClose} style={closeBtn}>
            {createdRaffleId ? "Done" : "Close"}
          </button>
        </div>

        <div style={body}>
          <div style={layout}>
            {/* LEFT */}
            <div style={{ minWidth: 0, display: "grid", gap: 12 }}>
              {/* Network settings */}
              <div style={panel}>
                <div style={panelTitleRow}>
                  <h3 style={panelTitle}>Network settings</h3>
                  <span style={statusChip}>{loading ? "Loading…" : data ? "Up to date" : "Unavailable"}</span>
                </div>

                {note && <div style={{ marginTop: 10, fontSize: 13, color: "rgba(15, 23, 42, 0.75)" }}>{note}</div>}

                <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 13, color: "rgba(15, 23, 42, 0.78)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>Ppopgi fee</span>
                    <b style={{ color: "#0F172A" }}>{data ? `${data.protocolFeePercent}%` : "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>Fee receiver</span>
                    <b style={{ color: "#0F172A" }}>{data ? short(data.feeRecipient) : "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>USDC contract</span>
                    <b style={{ color: "#0F172A" }}>{data ? short(data.usdc) : "—"}</b>
                  </div>
                </div>

                <div style={panelHint}>These come from the blockchain and can’t be changed by the app.</div>
              </div>

              {/* Details */}
              <div style={panel}>
                <div style={panelTitleRow}>
                  <h3 style={panelTitle}>Raffle details</h3>
                  <button style={btnSoft} onClick={() => setShowDetails((v) => !v)} type="button">
                    {showDetails ? "Hide details" : "Show details"}
                  </button>
                </div>

                <div style={label}>Name</div>
                <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ppopgi #12" />

                <div style={grid3}>
                  <div>
                    <div style={label}>Ticket price (USDC)</div>
                    <input
                      style={input}
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="1"
                    />
                    <div style={panelHint}>Whole numbers only.</div>
                  </div>

                  <div>
                    <div style={label}>Winning pot (USDC)</div>
                    <input
                      style={input}
                      value={winningPot}
                      onChange={(e) => setWinningPot(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="100"
                    />
                    <div style={panelHint}>Deposited when launching.</div>
                  </div>

                  <div>
                    <div style={label}>Duration</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                      <input
                        style={input}
                        value={durationValue}
                        onChange={(e) => setDurationValue(sanitizeIntInput(e.target.value))}
                        inputMode="numeric"
                        placeholder="24"
                      />
                      <select style={select} value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as any)}>
                        <option value="minutes">min</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                    </div>
                    <div style={panelHint}>{durationHint}</div>
                  </div>
                </div>

                <button style={btnSoft} onClick={() => setAdvancedOpen((v) => !v)} type="button">
                  {advancedOpen ? "Hide advanced options" : "Show advanced options"}
                </button>

                {advancedOpen && (
                  <div style={{ marginTop: 10 }}>
                    <div style={grid2}>
                      <div>
                        <div style={label}>Min tickets</div>
                        <input
                          style={input}
                          value={minTickets}
                          onChange={(e) => setMinTickets(sanitizeIntInput(e.target.value))}
                          inputMode="numeric"
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <div style={label}>Max tickets</div>
                        <input
                          style={input}
                          value={maxTickets}
                          onChange={(e) => setMaxTickets(sanitizeIntInput(e.target.value))}
                          inputMode="numeric"
                          placeholder="Unlimited"
                        />
                        <div style={panelHint}>{maxTickets.trim() === "" ? "Unlimited" : `Cap: ${maxTickets}`}</div>
                      </div>
                    </div>

                    <div>
                      <div style={label}>Min purchase (tickets)</div>
                      <input
                        style={input}
                        value={minPurchaseAmount}
                        onChange={(e) => setMinPurchaseAmount(sanitizeIntInput(e.target.value))}
                        inputMode="numeric"
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}

                {/* Simple status (no confusing approval amounts) */}
                <div style={statusRow}>
                  <span style={statusChip}>
                    Prize deposit permission:{" "}
                    {me ? (allowLoading ? "Checking…" : hasEnoughAllowance ? "✅ Ready" : "❌ Needed") : "Sign in"}
                  </span>
                  {showDetails && me && (
                    <span style={statusChip}>
                      Wallet: {allowLoading ? "…" : usdcBal !== null ? `${fmtUsdc(usdcBal)} USDC` : "—"}
                    </span>
                  )}
                  {showDetails && me && (
                    <span style={statusChip}>
                      Required: {fmtUsdc(requiredAllowanceU)} USDC
                    </span>
                  )}
                </div>

                <div style={steps}>
                  <button
                    style={needsAllow ? btnSoft : btnDisabled}
                    disabled={!needsAllow}
                    onClick={onEnablePrizeDeposit}
                    type="button"
                    title="This grants permission for the app to deposit the prize when creating."
                  >
                    {isPending ? "Confirming…" : me ? "Step 1 — Enable prize deposit" : "Sign in to continue"}
                  </button>

                  <button
                    style={canSubmit ? btnPrimary : btnDisabled}
                    disabled={!canSubmit}
                    onClick={onLaunchRaffle}
                    type="button"
                  >
                    {isPending ? "Creating…" : me ? "Step 2 — Launch raffle" : "Sign in to launch"}
                  </button>
                </div>

                {!hasEnoughBalance && requiredAllowanceU > 0n && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "rgba(15, 23, 42, 0.85)", fontWeight: 900 }}>
                    Not enough USDC for the winning pot deposit.
                  </div>
                )}

                {msg && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#0F172A", fontWeight: 1000 }}>
                    {msg}
                  </div>
                )}

                {shareUrl && (
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(15, 23, 42, 0.10)", background: "#FFFFFF" }}>
                    <div style={{ fontWeight: 1000 }}>Share your raffle</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "rgba(15, 23, 42, 0.70)" }}>
                      Copy this link and send it to a friend:
                    </div>
                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                      <input style={input} value={shareUrl} readOnly />
                      <button style={btnPrimary} onClick={onCopyShareLink} type="button">
                        {copied ? "Copied!" : "Copy link"}
                      </button>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "rgba(15, 23, 42, 0.65)" }}>
                      Raffle address: <b>{short(createdRaffleId)}</b>
                    </div>
                  </div>
                )}

                {/* Only show this explanation when user asks for details */}
                {showDetails && (
                  <div style={panelHint}>
                    “Permission” is not a payment. It can be higher than your wallet balance because it’s only an allowance.
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT */}
            <div style={{ minWidth: 0, ...previewWrap }}>
              <div style={panel}>
                <div style={panelTitleRow}>
                  <h3 style={panelTitle}>Preview</h3>
                  <span style={statusChip}>Updates as you type</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <RaffleCard raffle={previewRaffle as any} onOpen={() => {}} />
                </div>
                <div style={panelHint}>This is a visual preview only. Final values come from your transaction + the network.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}