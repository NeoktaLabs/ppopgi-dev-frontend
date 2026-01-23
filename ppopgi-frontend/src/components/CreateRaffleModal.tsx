// src/components/CreateRaffleModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "ethers";
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

// ---- amount helpers (allow decimal dot, but still safe) ----
function sanitizeDecimalInput(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function fmtUsdc(raw: bigint) {
  try {
    return formatUnits(raw, 6);
  } catch {
    return "0";
  }
}

export function CreateRaffleModal({ open, onClose, onCreated }: Props) {
  const { data, loading, note } = useFactoryConfig(open);

  const account = useActiveAccount();
  const me = account?.address ?? null;

  const { mutateAsync: sendAndConfirm, isPending } = useSendAndConfirmTransaction();

  // ---------- form state ----------
  const [name, setName] = useState("");
  const [ticketPrice, setTicketPrice] = useState("1"); // USDC (can be decimal)
  const [winningPot, setWinningPot] = useState("100"); // USDC (can be decimal)

  // Duration
  const [durationValue, setDurationValue] = useState("24");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");

  // Advanced (default hidden)
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Prefilled advanced defaults:
  // minTickets=1, maxTickets=unlimited(0), minPurchase=1
  const [minTickets, setMinTickets] = useState("1");
  const [maxTickets, setMaxTickets] = useState(""); // empty = unlimited
  const [minPurchaseAmount, setMinPurchaseAmount] = useState("1");

  const [msg, setMsg] = useState<string | null>(null);

  // --- Allowance/balance state (for CREATE) ---
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [allowLoading, setAllowLoading] = useState(false);

  const deployer = getContract({
    client: thirdwebClient,
    chain: ETHERLINK_CHAIN,
    address: ADDRESSES.SingleWinnerDeployer,
  });

  // USDC contract (from live config if present, else fallback)
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

  // Duration min/max: 5 minutes to 30 days
  const MIN_DURATION_SECONDS = 5 * 60;
  const MAX_DURATION_SECONDS = 30 * 24 * 3600;

  const durOk = durationSecondsN >= MIN_DURATION_SECONDS && durationSecondsN <= MAX_DURATION_SECONDS;

  // Advanced numbers (integers only)
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

  // Parse amounts (for gating + allowance checks). If invalid, treat as 0.
  const ticketPriceU = useMemo(() => {
    try {
      return parseUnits(ticketPrice || "0", 6);
    } catch {
      return 0n;
    }
  }, [ticketPrice]);

  const winningPotU = useMemo(() => {
    try {
      return parseUnits(winningPot || "0", 6);
    } catch {
      return 0n;
    }
  }, [winningPot]);

  // Required allowance for create (most likely the pot amount)
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
    minT > 0n &&
    ticketsOk &&
    minPurchaseOk &&
    requiredAllowanceU > 0n &&
    hasEnoughAllowance &&
    hasEnoughBalance;

  const needsAllow =
    !!me &&
    !isPending &&
    !!usdcContract &&
    requiredAllowanceU > 0n &&
    !hasEnoughAllowance;

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

  async function onAllowUsdc() {
    setMsg(null);

    if (!me) {
      setMsg("Please sign in first.");
      return;
    }
    if (!usdcContract) {
      setMsg("USDC contract not available right now.");
      return;
    }
    if (requiredAllowanceU <= 0n) {
      setMsg("Enter a winning pot first.");
      return;
    }

    try {
      const tx = prepareContractCall({
        contract: usdcContract,
        method: "function approve(address spender,uint256 amount) returns (bool)",
        params: [ADDRESSES.SingleWinnerDeployer, requiredAllowanceU],
      });

      await sendAndConfirm(tx);
      setMsg("USDC allowed. You can now create the raffle.");
      await refreshAllowance();
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) setMsg("Action canceled.");
      else setMsg("Could not allow USDC right now. Please try again.");
    }
  }

  async function onCreate() {
    setMsg(null);

    if (!me) {
      setMsg("Please sign in first.");
      return;
    }

    if (!durOk) {
      setMsg("Duration must be between 5 minutes and 30 days.");
      return;
    }

    if (!ticketsOk) {
      setMsg("Max tickets must be ≥ min tickets (or leave max empty for unlimited).");
      return;
    }

    if (!minPurchaseOk) {
      setMsg("Min purchase must be ≤ max tickets (or keep max unlimited).");
      return;
    }

    if (requiredAllowanceU <= 0n) {
      setMsg("Winning pot must be greater than 0.");
      return;
    }

    if (!hasEnoughBalance) {
      setMsg("Not enough USDC for the winning pot.");
      return;
    }

    if (!hasEnoughAllowance) {
      setMsg("Please allow USDC first.");
      return;
    }

    try {
      const durationSeconds = BigInt(durationSecondsN);

      const tx = prepareContractCall({
        contract: deployer,
        method:
          "function createSingleWinnerLottery(string name,uint256 ticketPrice,uint256 winningPot,uint64 minTickets,uint64 maxTickets,uint64 durationSeconds,uint32 minPurchaseAmount) returns (address lotteryAddr)",
        params: [
          name.trim(),
          ticketPriceU,
          winningPotU,
          minT,
          maxT, // 0 = unlimited
          durationSeconds,
          minPurchaseU32,
        ],
      });

      await sendAndConfirm(tx);

      setMsg("Raffle created successfully.");
      try {
        onCreated?.();
      } catch {}
      onClose();
    } catch (e: any) {
      const m = String(e?.reason || e?.shortMessage || e?.message || "");
      if (m.toLowerCase().includes("rejected")) {
        setMsg("Transaction canceled.");
      } else {
        setMsg(m || "Could not create the raffle. Please try again.");
      }
    }
  }

  if (!open) return null;

  // ----------------- STYLE (card / raffle vibes) -----------------
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
    width: "min(720px, 100%)",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.14)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
    padding: 16,
    color: "rgba(20,20,28,0.92)",
  };

  const header: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 8px 12px 8px",
  };

  const badge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.10)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.2,
  };

  const closeBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: 900,
    color: "rgba(20,20,28,0.88)",
  };

  const section: React.CSSProperties = {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
  };

  const sectionTitle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontWeight: 900,
    letterSpacing: 0.2,
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.08)",
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.95,
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

  const input: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: "12px 12px",
    outline: "none",
    color: "rgba(20,20,28,0.92)",
    fontWeight: 700,
  };

  const selectStyle: React.CSSProperties = {
    ...input,
    cursor: "pointer",
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  };

  const hint: React.CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.78,
  };

  const help: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.10)",
    fontSize: 12,
    fontWeight: 900,
    marginLeft: 8,
    cursor: "help",
    userSelect: "none",
    opacity: 0.9,
  };

  const labelRow = (text: string, tip: string) => (
    <div style={{ marginTop: 12, fontSize: 13, opacity: 0.86, display: "flex", alignItems: "center" }}>
      <span style={{ fontWeight: 900 }}>{text}</span>
      <span style={help} title={tip} aria-label={tip}>
        ?
      </span>
    </div>
  );

  const btnBase: React.CSSProperties = {
    width: "100%",
    marginTop: 12,
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
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(20,20,28,0.92)",
    opacity: 1,
  };

  const btnPrimaryEnabled: React.CSSProperties = {
    ...btnBase,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.30)",
    background: "rgba(255,255,255,0.22)",
    color: "rgba(20,20,28,0.92)",
    opacity: 1,
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    cursor: "not-allowed",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(20,20,28,0.72)",
    opacity: 0.65,
  };

  const divider: React.CSSProperties = {
    height: 1,
    marginTop: 12,
    background: "rgba(255,255,255,0.14)",
  };

  // ----------------------------------------------------------------

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Header */}
        <div style={header}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={badge}>
              <span style={{ opacity: 0.9 }}>Create</span>
              <span style={{ opacity: 0.65 }}>•</span>
              <span style={{ opacity: 0.9 }}>{ETHERLINK_MAINNET.chainName}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: 0.2 }}>Create a raffle</div>
            <div style={{ fontSize: 13, opacity: 0.78 }}>
              You’ll confirm every action in your wallet. Nothing happens automatically.
            </div>
          </div>

          <button onClick={onClose} style={closeBtn} aria-label="Close">
            Close
          </button>
        </div>

        {/* Live factory config */}
        <div style={section}>
          <div style={sectionTitle}>
            <span>Create settings (live)</span>
            <span style={pill}>
              {loading ? "Loading…" : data ? "Synced" : "Unavailable"}
            </span>
          </div>

          {note && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>{note}</div>}

          <div style={divider} />

          <div style={row}>
            <div style={label}>Ppopgi fee</div>
            <div style={{ fontWeight: 900 }}>{data ? `${data.protocolFeePercent}%` : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>Fee receiver</div>
            <div style={{ fontWeight: 900 }}>{data ? short(data.feeRecipient) : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>USDC</div>
            <div style={{ fontWeight: 900 }}>{data ? short(data.usdc) : "—"}</div>
          </div>

          <div style={row}>
            <div style={label}>Randomness provider</div>
            <div style={{ fontWeight: 900 }}>{data ? short(data.entropyProvider) : "—"}</div>
          </div>

          <div style={hint}>These settings are read from the network and can’t be changed by the app.</div>
        </div>

        {/* Form */}
        <div style={section}>
          <div style={sectionTitle}>
            <span>Raffle details</span>
            <span style={pill}>{advancedOpen ? "Advanced on" : "Simple"}</span>
          </div>

          {labelRow("Name", "Public name shown on the raffle card.")}
          <input
            style={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ppopgi #12"
          />

          <div style={grid2}>
            <div>
              {labelRow("Ticket price (USDC)", "Cost per ticket. You can use decimals (e.g. 1.5).")}
              <input
                style={input}
                value={ticketPrice}
                onChange={(e) => setTicketPrice(sanitizeDecimalInput(e.target.value))}
                placeholder="e.g. 1"
              />
            </div>

            <div>
              {labelRow("Winning pot (USDC)", "Prize amount deposited when creating. Needs USDC allowance.")}
              <input
                style={input}
                value={winningPot}
                onChange={(e) => setWinningPot(sanitizeDecimalInput(e.target.value))}
                placeholder="e.g. 100"
              />
            </div>
          </div>

          <div>
            {labelRow("Duration", "How long the raffle stays open. Min 5 minutes, max 30 days.")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <input
                style={input}
                value={durationValue}
                onChange={(e) => setDurationValue(sanitizeIntInput(e.target.value))}
                inputMode="numeric"
                placeholder="e.g. 15"
              />
              <select style={selectStyle} value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as any)}>
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>

            <div style={hint}>{durationHint}</div>
          </div>

          {/* Advanced settings */}
          <div style={{ marginTop: 14 }}>
            <button
              style={{
                width: "100%",
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "12px 14px",
                cursor: "pointer",
                fontWeight: 950,
                color: "rgba(20,20,28,0.92)",
              }}
              onClick={() => setAdvancedOpen((v) => !v)}
              type="button"
            >
              {advancedOpen ? "Hide advanced settings" : "Show advanced settings"}
            </button>

            {advancedOpen && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div style={grid2}>
                  <div>
                    {labelRow("Min tickets", "Raffle only finalizes after at least this many tickets are sold.")}
                    <input
                      style={input}
                      value={minTickets}
                      onChange={(e) => setMinTickets(sanitizeIntInput(e.target.value))}
                      inputMode="numeric"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    {labelRow("Max tickets", "Optional cap. Leave empty for unlimited.")}
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
                  {labelRow("Min purchase (tickets)", "Minimum tickets a user must buy in one purchase.")}
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
          </div>

          {/* Allowance helper */}
          {me && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={pill}>
                {allowLoading ? "Checking allowance…" : usdcBal !== null ? `Your USDC: ${fmtUsdc(usdcBal)}` : "USDC: —"}
              </span>
              <span style={pill}>
                {allowance !== null ? `Allowed: ${fmtUsdc(allowance)} USDC` : "Allowance: —"}
              </span>
            </div>
          )}

          {/* Buttons */}
          <button
            style={needsAllow ? btnSecondaryEnabled : btnDisabled}
            disabled={!needsAllow}
            onClick={onAllowUsdc}
            title="Allow USDC so the deployer can deposit the winning pot"
          >
            {isPending ? "Confirming…" : me ? "Allow USDC" : "Sign in to allow"}
          </button>

          <button style={canSubmit ? btnPrimaryEnabled : btnDisabled} disabled={!canSubmit} onClick={onCreate}>
            {isPending ? "Creating…" : me ? "Create raffle" : "Sign in to create"}
          </button>

          {!hasEnoughBalance && requiredAllowanceU > 0n && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              Not enough USDC for the winning pot.
            </div>
          )}

          {msg && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.92, fontWeight: 800 }}>
              {msg}
            </div>
          )}

          <div style={hint}>Nothing happens automatically. You always confirm actions yourself.</div>
        </div>
      </div>
    </div>
  );
}