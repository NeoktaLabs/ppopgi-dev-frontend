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
        // show the real error if we have it
        setMsg(m || "Could not create the raffle. Please try again.");
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

  const btnBase: React.CSSProperties = {
    width: "100%",
    marginTop: 12,
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.24)",
    borderRadius: 14,
    padding: "12px 12px",
    color: "#2B2B33",
    fontWeight: 800,
    textAlign: "center",
  };

  const btnEnabled: React.CSSProperties = { ...btnBase, cursor: "pointer", opacity: 1 };
  const btnDisabled: React.CSSProperties = { ...btnBase, cursor: "not-allowed", opacity: 0.6 };

  const help: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: 900,
    marginLeft: 6,
    cursor: "help",
    userSelect: "none",
  };

  const labelRow = (text: string, tip: string) => (
    <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, display: "flex", alignItems: "center" }}>
      <span>{text}</span>
      <span style={help} title={tip} aria-label={tip}>
        ?
      </span>
    </div>
  );

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

          {loading && <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>Loading create settings…</div>}
          {note && <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>{note}</div>}

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

          {labelRow("Name", "Public name shown on the raffle card.")}
          <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ppopgi #12" />

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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
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

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{durationHint}</div>
          </div>

          {/* Advanced settings */}
          <div style={{ marginTop: 14 }}>
            <button
              style={{
                border: "1px solid rgba(0,0,0,0.15)",
                background: "rgba(255,255,255,0.65)",
                borderRadius: 12,
                padding: "8px 10px",
                cursor: "pointer",
                fontWeight: 800,
              }}
              onClick={() => setAdvancedOpen((v) => !v)}
              type="button"
            >
              {advancedOpen ? "Hide advanced settings" : "Advanced settings"}
            </button>

            {advancedOpen && (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
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
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                      {maxTickets.trim() === "" ? "Unlimited" : `Cap: ${maxTickets}`}
                    </div>
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
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
              {allowLoading ? (
                "Checking USDC allowance…"
              ) : (
                <>
                  {usdcBal !== null ? `Your USDC: ${fmtUsdc(usdcBal)} • ` : ""}
                  {allowance !== null
                    ? `Allowed for create: ${fmtUsdc(allowance)} USDC`
                    : "Allowance unknown"}
                </>
              )}
            </div>
          )}

          {/* Allow step */}
          <button
            style={needsAllow ? btnEnabled : btnDisabled}
            disabled={!needsAllow}
            onClick={onAllowUsdc}
            title="Allow USDC so the deployer can deposit the winning pot"
          >
            {isPending ? "Confirming…" : me ? "Allow USDC" : "Sign in to allow"}
          </button>

          {/* Create */}
          <button style={canSubmit ? btnEnabled : btnDisabled} disabled={!canSubmit} onClick={onCreate}>
            {isPending ? "Creating…" : me ? "Create raffle" : "Sign in to create"}
          </button>

          {!hasEnoughBalance && requiredAllowanceU > 0n && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              Not enough USDC for the winning pot.
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            You will confirm actions in your wallet. Nothing happens automatically.
          </div>

          {msg && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>{msg}</div>}
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          Nothing happens automatically. You always confirm actions yourself.
        </div>
      </div>
    </div>
  );
}