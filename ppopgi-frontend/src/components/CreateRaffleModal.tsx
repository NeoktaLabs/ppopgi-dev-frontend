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
    if (durationSecondsN < MIN_DURATION_SECONDS) return "Minimum duration is 5 minutes.";
    if (durationSecondsN > MAX_DURATION_SECONDS) return "Maximum duration is 30 days.";
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
      setMsg("Nice — deposit enabled. Now you can launch your raffle.");
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not enable the deposit right now. Please try again.");
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
    if (!hasEnoughAllowance) return setMsg("First enable the prize deposit (Step 1).");

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
        setMsg("Raffle created 🎉 Share it with your friends!");
      } else {
        setMsg("Raffle created 🎉 (Couldn’t auto-detect the address from the receipt.)");
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

  // ----------------- LIVE PREVIEW OBJECT -----------------
  const previewRaffle: RaffleListItem = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = durOk ? String(now + durationSecondsN) : String(now + 3600);

    // Use entered USDC values converted to 6 decimals, like your real data.
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

  // ----------------- STYLES (prettier + two column + sticky preview) -----------------
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
    width: "min(980px, 100%)",
    maxHeight: "calc(100vh - 32px)",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const header: React.CSSProperties = {
    padding: "16px 16px 12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    borderBottom: "1px solid rgba(255,255,255,0.14)",
  };

  const badge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 12,
    fontWeight: 900,
  };

  const closeBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  const body: React.CSSProperties = {
    padding: 16,
    overflowY: "auto",
  };

  const layout: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 14,
  };

  const leftCol: React.CSSProperties = {
    minWidth: 0,
  };

  const rightCol: React.CSSProperties = {
    minWidth: 0,
    position: "sticky",
    top: 12,
    alignSelf: "start",
  };

  const section: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  };

  const sectionTitle: React.CSSProperties = {
    fontWeight: 1000,
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  };

  const pill: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.92,
  };

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: "12px 12px",
    outline: "none",
    fontWeight: 850,
  };

  const labelRow: React.CSSProperties = {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.9,
    fontWeight: 950,
  };

  const hint: React.CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.75,
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  };

  const btnBase: React.CSSProperties = {
    width: "100%",
    marginTop: 12,
    borderRadius: 16,
    padding: "12px 14px",
    fontWeight: 1000,
    letterSpacing: 0.2,
    border: "1px solid rgba(255,255,255,0.22)",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    background: "rgba(255,255,255,0.22)",
  };

  const btnSoft: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    background: "rgba(255,255,255,0.08)",
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    cursor: "not-allowed",
    opacity: 0.6,
    background: "rgba(255,255,255,0.04)",
  };

  const infoRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
  };

  const previewShell: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 12,
  };

  // Responsive: stack on small screens
  const mobileStack: React.CSSProperties = {
    display: "none",
  };

  // We can’t do media queries inline, so keep it simple:
  // This still looks good on mobile because the modal width shrinks,
  // and the grid naturally stacks poorly; if you want perfect mobile,
  // we should move these styles to CSS.
  // For now: allow wrapping by using a single column when screen is narrow
  const isNarrow = typeof window !== "undefined" ? window.innerWidth < 860 : false;
  const layoutStyle = isNarrow ? { ...layout, gridTemplateColumns: "1fr" } : layout;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={header}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={badge}>
              <span>Create</span>
              <span style={{ opacity: 0.65 }}>•</span>
              <span>{ETHERLINK_MAINNET.chainName}</span>
            </div>

            <div style={{ fontSize: 22, fontWeight: 1100 }}>Create a raffle</div>
            <div style={{ fontSize: 13, opacity: 0.78 }}>
              Live preview on the right — you’ll confirm every step in your wallet.
            </div>
          </div>

          <button onClick={onClose} style={closeBtn}>
            {createdRaffleId ? "Done" : "Close"}
          </button>
        </div>

        <div style={body}>
          <div style={layoutStyle}>
            {/* LEFT: form */}
            <div style={leftCol}>
              {/* Settings */}
              <div style={section}>
                <div style={sectionTitle}>
                  <span>Live settings</span>
                  <span style={pill}>{loading ? "Loading…" : data ? "Synced" : "Unavailable"}</span>
                </div>

                {note && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>{note}</div>}

                <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13, opacity: 0.92 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ opacity: 0.75 }}>Ppopgi fee</span>
                    <b>{data ? `${data.protocolFeePercent}%` : "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ opacity: 0.75 }}>Fee receiver</span>
                    <b>{data ? short(data.feeRecipient) : "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ opacity: 0.75 }}>USDC</span>
                    <b>{data ? short(data.usdc) : "—"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ opacity: 0.75 }}>Randomness provider</span>
                    <b>{data ? short(data.entropyProvider) : "—"}</b>
                  </div>
                </div>

                <div style={hint}>These are read from the network and can’t be changed by the app.</div>
              </div>

              {/* Details */}
              <div style={section}>
                <div style={sectionTitle}>
                  <span>Raffle details</span>
                  <span style={pill}>{advancedOpen ? "Advanced" : "Simple"}</span>
                </div>

                <div style={labelRow}>Name</div>
                <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ppopgi #12" />

                <div style={grid2}>
                  <div>
                    <div style={labelRow}>Ticket price (USDC)</div>
                    <input
                      style={input}
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="e.g. 1"
                    />
                    <div style={hint}>Whole numbers only (no decimals).</div>
                  </div>

                  <div>
                    <div style={labelRow}>Winning pot (USDC)</div>
                    <input
                      style={input}
                      value={winningPot}
                      onChange={(e) => setWinningPot(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="e.g. 100"
                    />
                    <div style={hint}>This is deposited when you launch.</div>
                  </div>
                </div>

                <div style={labelRow}>Duration</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <input
                    style={input}
                    value={durationValue}
                    onChange={(e) => setDurationValue(sanitizeIntInput(e.target.value))}
                    inputMode="numeric"
                    placeholder="e.g. 24"
                  />
                  <select style={input} value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as any)}>
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                    <option value="days">days</option>
                  </select>
                </div>
                <div style={hint}>{durationHint}</div>

                <button style={btnSoft} onClick={() => setAdvancedOpen((v) => !v)} type="button">
                  {advancedOpen ? "Hide advanced options" : "Show advanced options"}
                </button>

                {advancedOpen && (
                  <div style={{ marginTop: 10 }}>
                    <div style={grid2}>
                      <div>
                        <div style={labelRow}>Min tickets</div>
                        <input
                          style={input}
                          value={minTickets}
                          onChange={(e) => setMinTickets(sanitizeIntInput(e.target.value))}
                          inputMode="numeric"
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <div style={labelRow}>Max tickets</div>
                        <input
                          style={input}
                          value={maxTickets}
                          onChange={(e) => setMaxTickets(sanitizeIntInput(e.target.value))}
                          inputMode="numeric"
                          placeholder="Unlimited"
                        />
                        <div style={hint}>{maxTickets.trim() === "" ? "Unlimited" : `Cap: ${maxTickets}`}</div>
                      </div>
                    </div>

                    <div>
                      <div style={labelRow}>Min purchase (tickets)</div>
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

                {/* Allowance / balance */}
                {me && (
                  <div style={infoRow}>
                    <span style={pill}>
                      {allowLoading ? "Checking…" : usdcBal !== null ? `Wallet: ${fmtUsdc(usdcBal)} USDC` : "Wallet: —"}
                    </span>
                    <span style={pill}>
                      {allowance !== null ? `Approved: ${fmtUsdc(allowance)} USDC` : "Approved: —"}
                    </span>
                    <span style={pill}>
                      Required: <b>{fmtUsdc(requiredAllowanceU)} USDC</b>
                    </span>
                  </div>
                )}

                {/* Steps */}
                <button
                  style={needsAllow ? btnSoft : btnDisabled}
                  disabled={!needsAllow}
                  onClick={onEnablePrizeDeposit}
                  type="button"
                >
                  {isPending ? "Confirming…" : me ? "Step 1 — Enable prize deposit" : "Sign in to continue"}
                </button>

                <button style={canSubmit ? btnPrimary : btnDisabled} disabled={!canSubmit} onClick={onLaunchRaffle} type="button">
                  {isPending ? "Creating…" : me ? "Step 2 — Launch raffle" : "Sign in to launch"}
                </button>

                {!hasEnoughBalance && requiredAllowanceU > 0n && (
                  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                    Not enough USDC for the winning pot deposit.
                  </div>
                )}

                {msg && (
                  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.92, fontWeight: 1000 }}>
                    {msg}
                  </div>
                )}

                {shareUrl && (
                  <div style={{ marginTop: 12, ...previewShell }}>
                    <div style={{ fontWeight: 1000 }}>Share your raffle</div>
                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.86 }}>Copy this link and send it to a friend:</div>

                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                      <input style={input} value={shareUrl} readOnly />
                      <button style={btnPrimary} onClick={onCopyShareLink} type="button">
                        {copied ? "Copied!" : "Copy link"}
                      </button>
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>
                      Raffle address: <b>{short(createdRaffleId)}</b>
                    </div>
                  </div>
                )}

                <div style={hint}>
                  “Approved” can be higher than your wallet balance — it’s permission, not a payment.
                </div>
              </div>
            </div>

            {/* RIGHT: live preview */}
            <div style={isNarrow ? mobileStack : rightCol}>
              <div style={previewShell}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 1100 }}>Preview</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Updates as you type</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <RaffleCard raffle={previewRaffle as any} onOpen={() => {}} />
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                  This is a visual preview only. Final values come from your transaction + the network.
                </div>
              </div>
            </div>
          </div>

          {/* If narrow screen, show preview at bottom */}
          {isNarrow && (
            <div style={{ marginTop: 12 }}>
              <div style={previewShell}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 1100 }}>Preview</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Updates as you type</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <RaffleCard raffle={previewRaffle as any} onOpen={() => {}} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}