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

// Deployer event (to extract raffle address)
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

  // --- allowance/balance ---
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

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
    if (!hasEnoughAllowance) return setMsg("Step 1 is required: enable prize deposit.");

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

  // ---------- Premium UI styles ----------
  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const modal: React.CSSProperties = {
    width: "min(1060px, 100%)",
    maxHeight: "calc(100vh - 32px)",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 20,
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 35px 100px rgba(0,0,0,0.45)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const header: React.CSSProperties = {
    padding: "18px 20px",
    borderBottom: "1px solid rgba(15, 23, 42, 0.10)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  };

  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 20,
    fontWeight: 1000,
    letterSpacing: -0.2,
  };

  const subtitle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.70)",
    lineHeight: 1.35,
    maxWidth: 520,
  };

  const tag: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(2, 6, 23, 0.04)",
    border: "1px solid rgba(2, 6, 23, 0.10)",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(15, 23, 42, 0.80)",
    width: "fit-content",
  };

  const closeBtn: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.14)",
    background: "rgba(15, 23, 42, 0.04)",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 950,
    color: "#0f172a",
    whiteSpace: "nowrap",
  };

  const body: React.CSSProperties = {
    padding: 18,
    overflowY: "auto",
  };

  const layout: React.CSSProperties =
    typeof window !== "undefined" && window.innerWidth < 980
      ? { display: "grid", gridTemplateColumns: "1fr", gap: 14 }
      : { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 14 };

  const section: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
    overflow: "hidden",
  };

  const sectionHead: React.CSSProperties = {
    padding: "14px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
    background: "rgba(2, 6, 23, 0.02)",
  };

  const sectionTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 14,
    fontWeight: 1000,
    letterSpacing: -0.1,
  };

  const sectionBody: React.CSSProperties = {
    padding: 14,
    display: "grid",
    gap: 12,
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 950,
    color: "rgba(15, 23, 42, 0.80)",
  };

  const fieldHint: React.CSSProperties = {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(15, 23, 42, 0.62)",
    lineHeight: 1.35,
  };

  const controlBase: React.CSSProperties = {
    marginTop: 8,
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.14)",
    background: "#ffffff",
    padding: "11px 12px",
    height: 44,
    lineHeight: "22px",
    outline: "none",
    fontWeight: 850,
    color: "#0f172a",
  };

  const input = controlBase;
  const select = { ...controlBase, cursor: "pointer", paddingRight: 34 } as React.CSSProperties;

  const formGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  const durationGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  const chipsRow: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  };

  const chip: React.CSSProperties = {
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    background: "rgba(2, 6, 23, 0.03)",
    fontSize: 12,
    fontWeight: 950,
    color: "rgba(15, 23, 42, 0.78)",
  };

  const btnBase: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 1000,
    border: "1px solid rgba(15, 23, 42, 0.14)",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    background: "#0f172a",
    color: "#ffffff",
  };

  const btnSoft: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    background: "rgba(15, 23, 42, 0.04)",
    color: "#0f172a",
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    cursor: "not-allowed",
    opacity: 0.6,
    background: "rgba(15, 23, 42, 0.03)",
    color: "rgba(15, 23, 42, 0.70)",
  };

  const stickyPreview: React.CSSProperties =
    typeof window !== "undefined" && window.innerWidth >= 980
      ? { position: "sticky", top: 12, alignSelf: "start" }
      : {};

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={header}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={tag}>Network: {ETHERLINK_MAINNET.chainName}</div>
            <h2 style={title}>Create a raffle</h2>
            <div style={subtitle}>
              Step 1 enables the prize deposit. Step 2 launches your raffle. You confirm both in your wallet.
            </div>
          </div>

          <button onClick={onClose} style={closeBtn}>
            {createdRaffleId ? "Done" : "Close"}
          </button>
        </div>

        <div style={body}>
          <div style={layout}>
            {/* LEFT COLUMN */}
            <div style={{ minWidth: 0, display: "grid", gap: 14 }}>
              {/* Network settings */}
              <div style={section}>
                <div style={sectionHead}>
                  <h3 style={sectionTitle}>Network settings</h3>
                  <span style={chip}>{loading ? "Loading…" : data ? "Up to date" : "Unavailable"}</span>
                </div>

                <div style={sectionBody}>
                  {note && <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.75)" }}>{note}</div>}

                  <div style={{ display: "grid", gap: 8, fontSize: 13, color: "rgba(15, 23, 42, 0.80)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>Ppopgi fee</span>
                      <b style={{ color: "#0f172a" }}>{data ? `${data.protocolFeePercent}%` : "—"}</b>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>Fee receiver</span>
                      <b style={{ color: "#0f172a" }}>{data ? short(data.feeRecipient) : "—"}</b>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span>USDC contract</span>
                      <b style={{ color: "#0f172a" }}>{data ? short(data.usdc) : "—"}</b>
                    </div>
                  </div>

                  <div style={fieldHint}>These are read from the blockchain and can’t be changed.</div>
                </div>
              </div>

              {/* Raffle details */}
              <div style={section}>
                <div style={sectionHead}>
                  <h3 style={sectionTitle}>Raffle details</h3>
                  <button style={btnSoft} onClick={() => setAdvancedOpen((v) => !v)} type="button">
                    {advancedOpen ? "Hide advanced" : "Show advanced"}
                  </button>
                </div>

                <div style={sectionBody}>
                  {/* Name */}
                  <div>
                    <div style={label}>Name</div>
                    <input
                      style={input}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ppopgi #12"
                    />
                  </div>

                  {/* Price + Pot */}
                  <div style={formGrid}>
                    <div>
                      <div style={label}>Ticket price (USDC)</div>
                      <input
                        style={input}
                        value={ticketPrice}
                        onChange={(e) => setTicketPrice(sanitizeIntInput(e.target.value))}
                        inputMode="numeric"
                        placeholder="1"
                      />
                      <div style={fieldHint}>Whole numbers only.</div>
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
                      <div style={fieldHint}>Deposited when launching.</div>
                    </div>
                  </div>

                  {/* Duration (compact, not full width waste) */}
                  <div>
                    <div style={label}>Duration</div>
                    <div style={{ ...durationGrid, marginTop: 8 }}>
                      <input
                        style={input}
                        value={durationValue}
                        onChange={(e) => setDurationValue(sanitizeIntInput(e.target.value))}
                        inputMode="numeric"
                        placeholder="24"
                      />
                      <select
                        style={select}
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as any)}
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                    <div style={fieldHint}>{durationHint}</div>
                  </div>

                  {/* Advanced */}
                  {advancedOpen && (
                    <div style={{ display: "grid", gap: 12, paddingTop: 2 }}>
                      <div style={formGrid}>
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
                          <div style={fieldHint}>{maxTickets.trim() === "" ? "Unlimited" : `Cap: ${maxTickets}`}</div>
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

                      {/* Optional: only in advanced, explain the allowance concept in plain words */}
                      <div style={fieldHint}>
                        “Prize deposit permission” is an approval. It can be higher than your wallet balance because it’s
                        a permission — not a payment.
                      </div>
                    </div>
                  )}

                  {/* Status chips */}
                  <div style={chipsRow}>
                    <span style={chip}>
                      Prize deposit:{" "}
                      {me ? (allowLoading ? "Checking…" : hasEnoughAllowance ? "✅ Ready" : "❌ Needs setup") : "Sign in"}
                    </span>

                    <span style={chip}>
                      Wallet:{" "}
                      {me ? (allowLoading ? "…" : usdcBal !== null ? `${fmtUsdc(usdcBal)} USDC` : "—") : "—"}
                    </span>

                    <span style={chip}>Required: {fmtUsdc(requiredAllowanceU)} USDC</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "grid", gap: 10 }}>
                    <button
                      style={needsAllow ? btnSoft : btnDisabled}
                      disabled={!needsAllow}
                      onClick={onEnablePrizeDeposit}
                      type="button"
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
                    <div style={{ fontSize: 13, color: "rgba(15, 23, 42, 0.85)", fontWeight: 900 }}>
                      Not enough USDC for the winning pot deposit.
                    </div>
                  )}

                  {msg && <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 1000 }}>{msg}</div>}

                  {shareUrl && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid rgba(15, 23, 42, 0.10)",
                        background: "rgba(2, 6, 23, 0.02)",
                      }}
                    >
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

                      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(15, 23, 42, 0.65)" }}>
                        Raffle address: <b>{short(createdRaffleId)}</b>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (Preview) */}
            <div style={{ minWidth: 0, ...stickyPreview }}>
              <div style={section}>
                <div style={sectionHead}>
                  <h3 style={sectionTitle}>Preview</h3>
                  <span style={chip}>Updates as you type</span>
                </div>
                <div style={sectionBody}>
                  <RaffleCard raffle={previewRaffle as any} onOpen={() => {}} />
                  <div style={fieldHint}>
                    Preview only. Final values come from your transaction + the network.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}