// src/components/CashierModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits } from "ethers";
import { useActiveAccount } from "thirdweb/react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { getWalletBalance } from "thirdweb/wallets";

// Etherlink USDC (from your config / memory)
const USDC_ADDRESS = "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9";

type Props = {
  open: boolean;
  onClose: () => void;
};

function fmt(raw: bigint, decimals: number) {
  try {
    return formatUnits(raw, decimals);
  } catch {
    return "0";
  }
}

export function CashierModal({ open, onClose }: Props) {
  const activeAccount = useActiveAccount();
  const me = activeAccount?.address ?? null;

  const [xtz, setXtz] = useState<bigint | null>(null);
  const [usdc, setUsdc] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
      width: "min(720px, 100%)",
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

  const section: React.CSSProperties = {
    marginTop: 14,
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
    marginTop: 8,
  };

  const label: React.CSSProperties = { opacity: 0.85 };
  const value: React.CSSProperties = { fontWeight: 900 };

  const usdcContract = useMemo(() => {
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: USDC_ADDRESS,
    });
  }, []);

  const refresh = useCallback(async () => {
    setNote(null);

    if (!me) {
      setXtz(null);
      setUsdc(null);
      setNote("Sign in to see your balances on Etherlink.");
      return;
    }

    setLoading(true);
    try {
      // Native (XTZ): wallet balance on Etherlink
      const b = await getWalletBalance({
        client: thirdwebClient,
        chain: ETHERLINK_CHAIN,
        address: me,
      });

      // ERC20 (USDC): balanceOf
      const u = await readContract({
        contract: usdcContract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [me],
      });

      // thirdweb returns bigint-like; cast defensively
      setXtz(BigInt((b as any).value ?? 0n));
      setUsdc(BigInt(u as any));
    } catch (e: any) {
      setXtz(null);
      setUsdc(null);
      setNote("Could not load balances right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [me, usdcContract]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  if (!open) return null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Cashier</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Balances & getting started</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              This is read-only. It shows your balances on Etherlink.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={pill} onClick={refresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button style={pill} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {note && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>{note}</div>}

        <div style={section}>
          <div style={{ fontWeight: 900 }}>Your balances (Etherlink)</div>

          <div style={row}>
            <div style={label}>XTZ (gas)</div>
            <div style={value}>{xtz === null ? "—" : `${fmt(xtz, 18)} XTZ`}</div>
          </div>

          <div style={row}>
            <div style={label}>USDC</div>
            <div style={value}>{usdc === null ? "—" : `${fmt(usdc, 6)} USDC`}</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            You need a small amount of XTZ for gas even if you only use USDC.
          </div>
        </div>

        <div style={section}>
          <div style={{ fontWeight: 900 }}>How to get started</div>

          <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>
            <li>
              Get a little <b>XTZ</b> (for gas).
            </li>
            <li>
              Move funds to <b>Etherlink</b> (bridge or supported exchange route).
            </li>
            <li>
              Get <b>USDC on Etherlink</b> (bridge or swap), then come back and join raffles.
            </li>
          </ol>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Tip: if you see “—” above, sign in (wallet connect) and make sure you’re on Etherlink.
          </div>
        </div>
      </div>
    </div>
  );
}