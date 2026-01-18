// src/components/SignInModal.tsx
import React, { useMemo, useState } from "react";
import { connectInjected, connectWalletConnect } from "../wallet/connect";
import { useSession } from "../state/useSession";
import { ETHERLINK_MAINNET } from "../chain/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

function hasBrowserSignIn(): boolean {
  return typeof (window as any).ethereum !== "undefined";
}

function shortAccount(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function SignInModal({ open, onClose }: Props) {
  const setSession = useSession((s) => s.set);
  const [busy, setBusy] = useState<null | "browser" | "qr">(null);
  const [message, setMessage] = useState<string | null>(null);

  const browserAvailable = useMemo(() => hasBrowserSignIn(), []);

  if (!open) return null;

  async function doBrowser() {
    setMessage(null);
    setBusy("browser");
    try {
      const s = await connectInjected();
      setSession({
        provider: s.provider,
        signer: s.signer,
        account: s.account,
        chainId: s.chainId,
        connector: "injected",
        wcProvider: null,
      });
      onClose();
    } catch (e: any) {
      if (e?.message === "NO_INJECTED") {
        setMessage("No sign-in found in this browser. Try the QR option.");
      } else {
        setMessage("Could not sign in. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function doQr() {
    setMessage(null);
    setBusy("qr");
    try {
      const s = await connectWalletConnect();
      setSession({
        provider: s.provider,
        signer: s.signer,
        account: s.account,
        chainId: s.chainId,
        connector: "walletconnect",
        wcProvider: s.wcProvider,
      });
      onClose();
    } catch (e: any) {
      if (e?.message === "MISSING_WC_PROJECT_ID") {
        setMessage("Setup needed: missing QR sign-in key (project id).");
      } else if (e?.message === "WC_CONNECT_REJECTED") {
        setMessage("Sign in was canceled.");
      } else {
        setMessage("Could not sign in. Please try again.");
      }
    } finally {
      setBusy(null);
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
    zIndex: 9999,
  };

  const card: React.CSSProperties = {
    width: "min(460px, 100%)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.22)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
    padding: 18,
  };

  const titleRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const h2: React.CSSProperties = { margin: 0, fontSize: 18, color: "#2B2B33" };

  const closeBtn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
  };

  const p: React.CSSProperties = { margin: "10px 0 0", color: "#2B2B33", lineHeight: 1.35 };

  const buttonRow: React.CSSProperties = { display: "grid", gap: 10, marginTop: 14 };

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.24)",
    borderRadius: 14,
    padding: "12px 12px",
    cursor: "pointer",
    textAlign: "left",
    color: "#2B2B33",
  };

  const btnDisabled: React.CSSProperties = {
    ...btn,
    opacity: 0.55,
    cursor: "not-allowed",
  };

  const small: React.CSSProperties = { fontSize: 13, opacity: 0.85, marginTop: 4 };

  const note: React.CSSProperties = {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.85,
    color: "#2B2B33",
  };

  const infoBox: React.CSSProperties = {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.18)",
    color: "#2B2B33",
    fontSize: 13,
    lineHeight: 1.35,
  };

  const busyText =
    busy === "browser"
      ? "Signing in…"
      : busy === "qr"
      ? "Opening QR sign in…"
      : null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={titleRow}>
          <h2 style={h2}>Sign in</h2>
          <button style={closeBtn} onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        <p style={p}>
          Choose how you want to sign in. This app runs on <b>{ETHERLINK_MAINNET.chainName}</b>.
        </p>

        <div style={buttonRow}>
          <button
            style={browserAvailable && !busy ? btn : btnDisabled}
            disabled={!browserAvailable || !!busy}
            onClick={doBrowser}
          >
            <div style={{ fontWeight: 700 }}>Sign in (Browser)</div>
            <div style={small}>Best if you already have a sign-in tool in this browser.</div>
          </button>

          <button style={!busy ? btn : btnDisabled} disabled={!!busy} onClick={doQr}>
            <div style={{ fontWeight: 700 }}>Sign in (QR)</div>
            <div style={small}>Use your phone to sign in. Works well on Safari.</div>
          </button>
        </div>

        {(busyText || message) && (
          <div style={infoBox}>
            {busyText ? <div>{busyText}</div> : null}
            {message ? <div style={{ marginTop: busyText ? 8 : 0 }}>{message}</div> : null}
          </div>
        )}

        <div style={note}>
          Nothing happens automatically. You always confirm actions yourself.
        </div>
      </div>
    </div>
  );
}