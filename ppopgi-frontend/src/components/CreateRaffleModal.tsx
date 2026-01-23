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

// ---- integer-only helpers ----
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

const EXPLORER_BASE = "https://explorer.etherlink.com";
function explorerAddressUrl(addr: string) {
  return `${EXPLORER_BASE}/address/${addr}`;
}
function explorerTxUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

// Minimal event ABI to extract created raffle address (best-effort)
const DEPLOYER_EVENT_IFACE = new Interface([
  "event LotteryDeployed(address indexed lottery,address indexed creator,uint256 winningPot,uint256 ticketPrice,string name,address usdc,address entropy,address entropyProvider,uint32 callbackGasLimit,address feeRecipient,uint256 protocolFeePercent,uint64 deadline,uint64 minTickets,uint64 maxTickets)",
]);

export function CreateRaffleModal({ open, onClose, onCreated }: Props) {
  const { data, loading, note } = useFactoryConfig(open);

  const account = useActiveAccount();
  const me = account?.address ?? null;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // ---------- form state ----------
  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("1"); // ✅ integer-only USDC
  const [winningPot, setWinningPot] = useState("100"); // ✅ integer-only USDC

  // Duration
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");

  // Advanced (collapsed by default)
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); // empty = unlimited
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  // UX messages + share
  const [msg, setMsg] = useState<string | null>(null);
  const [createdRaffleId, setCreatedRaffleId] = useState<string | null>(null);
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);

  // --- Allowance/balance state ---
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  const deployer = getContract({
    client: thirdwebClient,
    chain: ETHERLINK_CHAIN,
    address: ADDRESSES.SingleWinnerDeployer,
  });

  // USDC contract (from live config if present, else fallback)
  const usdcAddr = data?.usdc || ADDRESSES.USDC;
  const usdcContract = useMemo(() => {
    if (!usdcAddr) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: usdcAddr,
    });
  }, [usdcAddr]);

  // ---- parse + validate ----
  const durV = toIntStrict(durationValue, 0);
  const durationSecondsN = durV * unitToSeconds(durationUnit);

  const MIN_DURATION_SECONDS = 5 * 60;
  const MAX_DURATION_SECONDS = 30 * 24 * 3600;
  const durOk = durationSecondsN >= MIN_DURATION_SECONDS && durationSecondsN <= MAX_DURATION_SECONDS;

  // Advanced ints
  const minTn = toIntStrict(minTickets, 1);
  const maxTnRaw = toIntStrict(maxTickets, 0);
  const maxTn = maxTickets.trim() === "" ? 0 : maxTnRaw; // 0 means unlimited
  const minPurchase = toIntStrict(minPurchaseAmount, 1);

  const minT = BigInt(Math.max(1, minTn));
  const maxT = BigInt(Math.max(0, maxTn));
  const minPurchaseU32 = Math.max(1, minPurchase);

  const maxTicketsIsUnlimited = maxTickets.trim() === "" || maxTn === 0;
  const ticketsOk = maxTicketsIsUnlimited ? true : maxT >= minT;
  const minPurchaseOk = maxTicketsIsUnlimited ? true : BigInt(minPurchaseU32) <= maxT;

  // ✅ integer-only amounts
  const ticketPriceU = useMemo(() => {
    const n = toIntStrict(ticketPrice, 0);
    try {
      return parseUnits(String(n), 6);
    } catch {
      return 0n;
    }
  }, [ticketPrice]);

  const winningPotU = useMemo(() => {
    const n = toIntStrict(winningPot, 0);
    try {
      return parseUnits(String(n), 6);
    } catch {
      return 0n;
    }
  }, [winningPot]);

  // Required allowance for create
  const requiredAllowanceU = winningPotU;

  const hasEnoughAllowance = allowance !== null ? allowance >= requiredAllowanceU : false;
  const hasEnoughBalance = usdcBal !== null ? usdcBal >= requiredAllowanceU : true;

  const durationHint = useMemo(() => {
    if (!durV) return "Pick a duration.";
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
    minT > 0n &&
    ticketsOk &&
    minPurchaseOk &&
    requiredAllowanceU > 0n &&
    hasEnoughAllowance &&
    hasEnoughBalance;

  const needsPermission =
    !!me && !isPending && !!usdcContract && requiredAllowanceU > 0n && !hasEnoughAllowance;

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
    if (!me) return;
    refreshAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, me, usdcContract?.address]);

  async function onGrantPermission() {
    setMsg(null);

    if (!me) return setMsg("Please sign in first.");
    if (!usdcContract) return setMsg("USDC contract not available right now.");
    if (requiredAllowanceU <= 0n) return setMsg("Enter a prize amount first.");

    try {
      // ✅ Approve exactly the prize pot (keeps it simple & predictable)
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender,uint256 amount) returns (bool)",
        params: [ADDRESSES.SingleWinnerDeployer, requiredAllowanceU],
      });

      await sendAndConfirm(tx);
      await refreshAllowance();
      setMsg("Permission granted. You can now create your raffle.");
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not grant permission right now. Please try again.");
    }
  }

  async function onCreate() {
    setMsg(null);
    setCreatedRaffleId(null);
    setCreatedTxHash(null);

    if (!me) return setMsg("Please sign in first.");
    if (!durOk) return setMsg("Duration must be between 5 minutes and 30 days.");
    if (!ticketsOk) return setMsg("Max tickets must be ≥ min tickets (or leave max empty for unlimited).");
    if (!minPurchaseOk) return setMsg("Min purchase must be ≤ max tickets (or keep max unlimited).");
    if (requiredAllowanceU <= 0n) return setMsg("Prize must be greater than 0.");
    if (!hasEnoughBalance) return setMsg("Not enough USDC for the prize.");
    if (!hasEnoughAllowance) return setMsg("Please grant permission first.");

    try {
      const durationSeconds = BigInt(durationSecondsN);

      const tx = prepareContractCall({
        contract: deployer,
        method:
          "function createSingleWinnerLottery(string name,uint256 ticketPrice,uint256 winningPot,uint64 minTickets,uint64 maxTickets,uint64 durationSeconds,uint32 minPurchaseAmount) returns (address lotteryAddr)",
        params: [name.trim(), ticketPriceU, winningPotU, minT, maxT, durationSeconds, minPurchaseU32],
      });

      const res: any = await sendAndConfirm(tx);

      // --- best effort: extract tx hash + new raffle address from logs ---
      const txHash =
        String(res?.transactionHash || res?.receipt?.transactionHash || res?.transactionReceipt?.transactionHash || "");
      if (txHash) setCreatedTxHash(txHash);

      let createdAddr: string | null = null;
      const logs = res?.receipt?.logs || res?.transactionReceipt?.logs || res?.logs || [];
      try {
        for (const lg of logs) {
          const topics = lg?.topics;
          const dataHex = lg?.data;
          if (!topics || !dataHex) continue;
          try {
            const parsed = DEPLOYER_EVENT_IFACE.parseLog({ topics, data: dataHex });
            if (parsed?.name === "LotteryDeployed") {
              const addr = String(parsed.args?.lottery || "");
              if (isHexAddress(addr)) {
                createdAddr = addr;
                break;
              }
            }
          } catch {
            // ignore parse failures
          }
        }
      } catch {}

      if (createdAddr) setCreatedRaffleId(createdAddr);

      setMsg("Raffle created 🎉");
      try {
        onCreated?.();
      } catch {}

      // keep modal open so user can copy/share
      // (they can close manually)
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Transaction canceled.");
      else setMsg(m || "Could not create the raffle. Please try again.");
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied link ✅");
    } catch {
      setMsg("Could not copy automatically. Please copy it manually.");
    }
  }

  if (!open) return null;

  // ----------------- STYLE: premium light modal + section tones -----------------
  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 10500,
  };

  const modal: React.CSSProperties = {
    width: "min(980px, 100%)",
    maxHeight: "calc(100vh - 32px)",
    overflow: "auto",
    borderRadius: 22,
    background: "rgba(255,255,255,0.96)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.30)",
    color: "rgba(20,20,28,0.92)",
  };

  const modalInner: React.CSSProperties = {
    padding: 18,
  };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 14,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  };

  const title: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: 0.2,
    margin: 0,
  };

  const subtitle: React.CSSProperties = {
    fontSize: 13,
    opacity: 0.8,
    marginTop: 6,
    lineHeight: 1.35,
  };

  const closeBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.9)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
  };

  const layout: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 14,
    marginTop: 14,
  };

  const sectionBase: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.06)",
    padding: 14,
  };

  const sectionA: React.CSSProperties = { ...sectionBase, background: "rgba(0,0,0,0.02)" };
  const sectionB: React.CSSProperties = { ...sectionBase, background: "rgba(0,0,0,0.035)" };
  const sectionC: React.CSSProperties = { ...sectionBase, background: "rgba(0,0,0,0.025)" };

  const sectionTitle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    fontWeight: 950,
    letterSpacing: 0.2,
    fontSize: 14,
    marginBottom: 10,
  };

  const smallPill: React.CSSProperties = {
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 8,
  };

  const label: React.CSSProperties = { opacity: 0.72 };

  const linkStyle: React.CSSProperties = {
    fontWeight: 900,
    color: "rgba(20,20,28,0.92)",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  };

  const inputLabel: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
  };

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.92)",
    borderRadius: 14,
    padding: "12px 12px",
    outline: "none",
    color: "rgba(20,20,28,0.92)",
    fontWeight: 800,
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  };

  const grid3: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginTop: 10,
  };

  const selectStyle: React.CSSProperties = {
    ...input,
    cursor: "pointer",
    paddingRight: 12,
  };

  const hint: React.CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 1.35,
  };

  const dangerText: React.CSSProperties = {
    marginTop: 10,
    fontSize: 13,
    fontWeight: 950,
    color: "#b42318",
    textAlign: "center",
  };

  const btnBase: React.CSSProperties = {
    width: "100%",
    borderRadius: 16,
    padding: "12px 14px",
    fontWeight: 950,
    letterSpacing: 0.2,
    textAlign: "center",
    transition: "transform 120ms ease, opacity 120ms ease",
  };

  const btnSecondaryEnabled: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.92)",
  };

  const btnPrimaryEnabled: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.06)",
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    cursor: "not-allowed",
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.03)",
    opacity: 0.55,
  };

  // ----------------- preview values -----------------
  const preview = useMemo(() => {
    const tp = toIntStrict(ticketPrice, 0);
    const pot = toIntStrict(winningPot, 0);

    const minTShow = String(minT);
    const maxTShow = maxTicketsIsUnlimited ? "Unlimited" : String(maxT);
    const ends = durOk ? durationHint.replace("Ends at: ", "") : "—";

    return {
      name: name.trim() || "Your raffle name",
      ticketPrice: tp,
      winningPot: pot,
      minTickets: minTShow,
      maxTickets: maxTShow,
      ends,
    };
  }, [name, ticketPrice, winningPot, minT, maxT, maxTicketsIsUnlimited, durOk, durationHint]);

  const permissionReady = hasEnoughAllowance && requiredAllowanceU > 0n;

  const shareUrl = useMemo(() => {
    if (!createdRaffleId) return null;
    try {
      return `${window.location.origin}/raffle/${createdRaffleId}`;
    } catch {
      return `/raffle/${createdRaffleId}`;
    }
  }, [createdRaffleId]);

  const network = {
    deployer: ADDRESSES.SingleWinnerDeployer,
    usdc: data?.usdc || ADDRESSES.USDC,
    entropy: data?.entropy || null,
    entropyProvider: data?.entropyProvider || null,
    feeRecipient: data?.feeRecipient || null,
  };

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={modalInner}>
          {/* Header */}
          <div style={header}>
            <div>
              <h3 style={title}>Create a raffle</h3>
              <div style={subtitle}>
                You’ll always confirm actions in your wallet. This app never acts automatically.
              </div>
            </div>

            <button onClick={onClose} style={closeBtn} aria-label="Close">
              Close
            </button>
          </div>

          <div style={layout}>
            {/* LEFT: form */}
            <div style={{ display: "grid", gap: 12 }}>
              {/* Network settings */}
              <div style={sectionA}>
                <div style={sectionTitle}>
                  <span>Network settings</span>
                  <span style={smallPill}>{loading ? "Loading…" : data ? "Connected" : "Unavailable"}</span>
                </div>

                {note && <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>{note}</div>}

                <div style={row}>
                  <div style={label}>Network</div>
                  <div style={{ fontWeight: 900 }}>{ETHERLINK_MAINNET.chainName}</div>
                </div>

                <div style={row}>
                  <div style={label}>Deployer</div>
                  <div style={{ fontWeight: 900 }}>
                    {isHexAddress(network.deployer) ? (
                      <a href={explorerAddressUrl(network.deployer)} target="_blank" rel="noreferrer" style={linkStyle}>
                        {short(network.deployer)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div style={row}>
                  <div style={label}>USDC token</div>
                  <div style={{ fontWeight: 900 }}>
                    {network.usdc && isHexAddress(network.usdc) ? (
                      <a href={explorerAddressUrl(network.usdc)} target="_blank" rel="noreferrer" style={linkStyle}>
                        {short(network.usdc)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div style={row}>
                  <div style={label}>Entropy contract</div>
                  <div style={{ fontWeight: 900 }}>
                    {network.entropy && isHexAddress(network.entropy) ? (
                      <a href={explorerAddressUrl(network.entropy)} target="_blank" rel="noreferrer" style={linkStyle}>
                        {short(network.entropy)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div style={row}>
                  <div style={label}>Entropy provider</div>
                  <div style={{ fontWeight: 900 }}>
                    {network.entropyProvider && isHexAddress(network.entropyProvider) ? (
                      <a
                        href={explorerAddressUrl(network.entropyProvider)}
                        target="_blank"
                        rel="noreferrer"
                        style={linkStyle}
                      >
                        {short(network.entropyProvider)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div style={row}>
                  <div style={label}>Fee receiver</div>
                  <div style={{ fontWeight: 900 }}>
                    {network.feeRecipient && isHexAddress(network.feeRecipient) ? (
                      <a
                        href={explorerAddressUrl(network.feeRecipient)}
                        target="_blank"
                        rel="noreferrer"
                        style={linkStyle}
                      >
                        {short(network.feeRecipient)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                <div style={hint}>These are read from the blockchain and can’t be changed in the app.</div>
              </div>

              {/* Raffle details */}
              <div style={sectionB}>
                <div style={sectionTitle}>
                  <span>Raffle details</span>
                  <span style={smallPill}>Preview updates live</span>
                </div>

                <div style={inputLabel}>Name</div>
                <input
                  style={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ppopgi #12"
                />

                <div style={grid2}>
                  <div>
                    <div style={inputLabel}>Ticket price (USDC)</div>
                    <input
                      style={input}
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="e.g. 1"
                    />
                    <div style={hint}>Whole numbers only.</div>
                  </div>

                  <div>
                    <div style={inputLabel}>Prize (USDC)</div>
                    <input
                      style={input}
                      value={winningPot}
                      onChange={(e) => setWinningPot(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="e.g. 100"
                    />
                    <div style={hint}>This is the USDC you deposit when creating.</div>
                  </div>
                </div>

                {/* Duration condensed */}
                <div style={grid3}>
                  <div>
                    <div style={inputLabel}>Duration</div>
                    <input
                      style={input}
                      value={durationValue}
                      onChange={(e) => setDurationValue(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="24"
                    />
                  </div>
                  <div>
                    <div style={inputLabel}>Unit</div>
                    <select style={selectStyle} value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as any)}>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  <div>
                    <div style={inputLabel}>Ends</div>
                    <div style={{ ...input, display: "flex", alignItems: "center", fontWeight: 900, opacity: 0.9 }}>
                      {durOk ? preview.ends : "—"}
                    </div>
                  </div>
                </div>

                <div style={hint}>{durationHint}</div>

                {/* Advanced toggle (ONLY expandable) */}
                <div style={{ marginTop: 10 }}>
                  <button
                    style={btnSecondaryEnabled}
                    onClick={() => setAdvancedOpen((v) => !v)}
                    type="button"
                  >
                    {advancedOpen ? "Hide advanced settings" : "Show advanced settings"}
                  </button>

                  {advancedOpen && (
                    <div style={{ marginTop: 12 }}>
                      <div style={sectionC}>
                        <div style={sectionTitle}>
                          <span>Advanced settings</span>
                          <span style={smallPill}>Optional</span>
                        </div>

                        <div style={grid2}>
                          <div>
                            <div style={inputLabel}>Min tickets</div>
                            <input
                              style={input}
                              value={minTickets}
                              onChange={(e) => setMinTickets(sanitizeIntInput(e.target.value))}
                              inputMode="numeric"
                              placeholder="1"
                            />
                            <div style={hint}>Raffle can only finalize after this many tickets are sold.</div>
                          </div>

                          <div>
                            <div style={inputLabel}>Max tickets</div>
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

                        <div style={{ marginTop: 10 }}>
                          <div style={inputLabel}>Min purchase (tickets)</div>
                          <input
                            style={input}
                            value={minPurchaseAmount}
                            onChange={(e) => setMinPurchaseAmount(sanitizeIntInput(e.target.value))}
                            inputMode="numeric"
                            placeholder="1"
                          />
                          <div style={hint}>Minimum tickets a user must buy per purchase.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Funding + actions */}
              <div style={sectionA}>
                <div style={sectionTitle}>
                  <span>Funding & confirmation</span>
                  <span style={smallPill}>{permissionReady ? "Ready" : "Needs permission"}</span>
                </div>

                {me && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                    <span style={smallPill}>
                      {allowLoading ? "Checking…" : usdcBal !== null ? `Your USDC: ${fmtUsdc(usdcBal)}` : "Your USDC: —"}
                    </span>
                    <span style={smallPill}>
                      {requiredAllowanceU > 0n
                        ? permissionReady
                          ? "Spending permission: granted"
                          : "Spending permission: not granted"
                        : "Spending permission: —"}
                    </span>
                  </div>
                )}

                {!hasEnoughBalance && requiredAllowanceU > 0n && <div style={dangerText}>Not enough USDC for the prize.</div>}

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <button
                    style={needsPermission ? btnSecondaryEnabled : btnDisabled}
                    disabled={!needsPermission}
                    onClick={onGrantPermission}
                    title="This lets the deployer deposit the prize USDC when you create."
                  >
                    {isPending ? "Confirming…" : me ? "Grant permission to deposit prize" : "Sign in to continue"}
                  </button>

                  <button style={canSubmit ? btnPrimaryEnabled : btnDisabled} disabled={!canSubmit} onClick={onCreate}>
                    {isPending ? "Creating…" : me ? "Create raffle" : "Sign in to create"}
                  </button>
                </div>

                {msg && (
                  <div style={{ marginTop: 12, fontSize: 13, fontWeight: 950, opacity: 0.92 }}>
                    {msg}
                  </div>
                )}

                {/* Share block after create */}
                {(shareUrl || createdTxHash) && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>Share</div>

                    {shareUrl ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ ...input, fontWeight: 800, display: "flex", alignItems: "center" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{shareUrl}</span>
                        </div>
                        <button style={btnSecondaryEnabled} onClick={() => copyToClipboard(shareUrl)}>
                          Copy share link
                        </button>
                      </div>
                    ) : null}

                    {createdTxHash ? (
                      <div style={{ marginTop: 10, fontSize: 13 }}>
                        Transaction:{" "}
                        <a href={explorerTxUrl(createdTxHash)} target="_blank" rel="noreferrer" style={linkStyle}>
                          View on explorer
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}

                <div style={hint}>
                  Nothing happens automatically — you approve each step in your wallet.
                </div>
              </div>
            </div>

            {/* RIGHT: preview card */}
            <div style={{ display: "grid", gap: 12 }}>
              <div style={sectionB}>
                <div style={sectionTitle}>
                  <span>Preview</span>
                  <span style={smallPill}>Card</span>
                </div>

                <div
                  style={{
                    borderRadius: 18,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "rgba(255,255,255,0.95)",
                    padding: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 950 }}>{preview.name}</div>

                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75 }}>Prize</span>
                      <span style={{ fontWeight: 950 }}>{preview.winningPot} USDC</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75 }}>Ticket</span>
                      <span style={{ fontWeight: 950 }}>{preview.ticketPrice} USDC</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75 }}>Ends</span>
                      <span style={{ fontWeight: 900, textAlign: "right" }}>{durOk ? preview.ends : "—"}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75 }}>Min tickets</span>
                      <span style={{ fontWeight: 900 }}>{preview.minTickets}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ opacity: 0.75 }}>Max tickets</span>
                      <span style={{ fontWeight: 900 }}>{preview.maxTickets}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
                    This is a preview. Final card data comes from the blockchain & indexer after creation.
                  </div>
                </div>
              </div>

              <div style={sectionA}>
                <div style={sectionTitle}>
                  <span>Tips</span>
                  <span style={smallPill}>Quick</span>
                </div>
                <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
                  <div>• “Permission to deposit prize” is like a one-time spending permission.</div>
                  <div>• Your balance and your permission can be different values — that’s normal.</div>
                  <div>• If you change the prize, you may need to grant permission again.</div>
                </div>
              </div>
            </div>
          </div>

          {/* bottom padding so scroll never cuts content */}
          <div style={{ height: 6 }} />
        </div>
      </div>
    </div>
  );
}