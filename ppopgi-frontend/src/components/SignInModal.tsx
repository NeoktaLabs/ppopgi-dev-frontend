// src/components/SignInModal.tsx
import React, { useMemo, useState } from "react";
import { connectInjected, connectWalletConnect } from "../wallet/connect";
import { connectMetaMaskInjected } from "../wallet/metamask";
import { useSession } from "../state/useSession";
import { ETHERLINK_MAINNET } from "../chain/etherlink";

type Props = {
  open: boolean;
  onClose: () => void;
};

function hasBrowserSignIn(): boolean {
  return typeof (window as any).ethereum !== "undefined";
}

function hasMetaMaskHint(): boolean {
  const eth = (window as any).ethereum;
  if (!eth) return false;

  if (eth.isMetaMask) return true;

  if (Array.isArray(eth.providers)) {
    return eth.providers.some((p: any) => p?.isMetaMask);
  }
  return false;
}

export function SignInModal({ open, onClose }: Props) {
  const setSession = useSession((s) => s.set);
  const [busy, setBusy] = useState<null | "browser" | "qr" | "metamask">(null);
  const [message, setMessage] = useState<string | null>(null);

  const browserAvailable = useMemo(() => hasBrowserSignIn(), []);
  const metaMaskHint = useMemo(() => hasMetaMaskHint(), []);

  const metaMaskWalletId =
    (import.meta.env.VITE_MM_WC_WALLET_ID as string | undefined) || undefined;

  if (!open) return null;

  async function doMetaMask() {
    setMessage(null);
    setBusy("metamask");

    try {
      // 1) Prefer injected MetaMask (extension / MetaMask in-app browser)
      try {
        const s = await connectMetaMaskInjected();
        setSession({
          provider: s.provider,
          signer: s.signer,
          account: s.account,
          chainId: s.chainId,
          connector: "metamask_injected",
          wcProvider: null,
        });
        onClose();
        return;
      } catch (e: any) {
        if (e?.message !== "NO_METAMASK_INJECTED") throw e;
      }

      // 2) Fallback: WalletConnect (all wallets), recommend MetaMask if possible
      const s2 = await connectWalletConnect({
        recommendedWalletIds: metaMaskWalletId ? [metaMaskWalletId] : undefined,
      });

      setSession({
        provider: s2.provider,
        signer: s2.signer,
        account: s2.account,
        chainId: s2.chainId,
        connector: "walletconnect",
        wcProvider: s2.wcProvider,
      });
      onClose();
    } catch (e: any) {
      if (e?.message === "MISSING_WC_PROJECT_ID") {
        setMessage("Setup needed: missing QR sign-in key.");
      } else if (e?.message === "WC_CONNECT_REJECTED") {
        setMessage("Sign in was canceled.");
      } else {
        setMessage("Could not sign in. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

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
        setMessage("Setup needed: missing QR sign-in key.");
      } else if (e?.message === "WC_CONNECT_REJECTED") {
        setMessage("Sign in was canceled.");
      } else {
        setMessage("Could not sign in. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  const busyText =
    busy === "metamask"
      ? "Opening sign in…"
      : busy === "browser"
      ? "Signing in…"
      : busy === "qr"
      ? "Opening sign in…"
      : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(255,255,255,0.22)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          padding: 18,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, color: "#2B2B33" }}>Sign in</h2>
          <button
            style={{
              border: "1px solid rgba(255,255,255,0.5)",
              background: "rgba(255,255,255,0.25)",
              borderRadius: 12,
              padding: "8px 10px",
              cursor: "pointer",
            }}
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <p style={{ margin: "10px 0 0", color: "#2B2B33", lineHeight: 1.35 }}>
          Choose how you want to sign in. This app runs on{" "}
          <b>{ETHERLINK_MAINNET.chainName}</b>.
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {/* MetaMask */}
          <button
            style={{
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.24)",
              borderRadius: 14,
              padding: "12px 12px",
              cursor: "pointer",
              textAlign: "left",
              color: "#2B2B33",
              opacity: busy ? 0.55 : 1,
            }}
            disabled={!!busy}
            onClick={doMetaMask}
          >
            <div style={{ fontWeight: 700 }}>MetaMask</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              {metaMaskHint
                ? "Use MetaMask in this browser."
                : metaMaskWalletId
                ? "You can still use MetaMask from your phone."
                : "You can still use MetaMask from your phone. Choose MetaMask in the list."}
            </div>
          </button>

          {/* Browser */}
          <button
            style={{
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.24)",
              borderRadius: 14,
              padding: "12px 12px",
              cursor: browserAvailable && !busy ? "pointer" : "not-allowed",
              textAlign: "left",
              color: "#2B2B33",
              opacity: browserAvailable && !busy ? 1 : 0.55,
            }}
            disabled={!browserAvailable || !!busy}
            onClick={doBrowser}
          >
            <div style={{ fontWeight: 700 }}>Sign in (Browser)</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              Best if you already have a sign-in tool in this browser.
            </div>
          </button>

          {/* QR */}
          <button
            style={{
              border: "1px solid rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.24)",
              borderRadius: 14,
              padding: "12px 12px",
              cursor: !busy ? "pointer" : "not-allowed",
              textAlign: "left",
              color: "#2B2B33",
              opacity: !busy ? 1 : 0.55,
            }}
            disabled={!!busy}
            onClick={doQr}
          >
            <div style={{ fontWeight: 700 }}>Sign in (QR)</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              Use your phone to sign in. Works well on Safari.
            </div>
          </button>
        </div>

        {(busyText || message) && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.18)",
              color: "#2B2B33",
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {busyText && <div>{busyText}</div>}
            {message && <div style={{ marginTop: busyText ? 8 : 0 }}>{message}</div>}
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85, color: "#2B2B33" }}>
          Nothing happens automatically. You always confirm actions yourself.
        </div>
      </div>
    </div>
  );
}