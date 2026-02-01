// src/components/TopNav.tsx
import React from "react";

type Page = "home" | "explore" | "dashboard";

type Props = {
  page: Page;
  account: string | null;

  onNavigate: (p: Page) => void;
  onOpenExplore: () => void; // optional convenience, but still uses callbacks
  onOpenDashboard: () => void;
  onOpenCreate: () => void;
  onOpenCashier: () => void;
  onOpenSignIn: () => void;
  onSignOut: () => void;
};

function short(a: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function TopNav({
  page,
  account,
  onNavigate,
  onOpenExplore,
  onOpenDashboard,
  onOpenCreate,
  onOpenCashier,
  onOpenSignIn,
  onSignOut,
}: Props) {
  const ink = "#4A0F2B";

  // ✅ New topbar visuals (matches your cards/modals vibe)
  const topbar: React.CSSProperties = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.45))," +
      "radial-gradient(900px 220px at 15% 0%, rgba(255,141,187,0.18), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 220px at 85% 0%, rgba(203,183,246,0.18), rgba(203,183,246,0) 55%)",
    border: "1px solid rgba(255,255,255,0.65)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.14)",
    backdropFilter: "blur(10px)",
  };

  const brandPill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    letterSpacing: 0.25,
    cursor: "pointer",
    userSelect: "none",
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: ink,
  };

  const brandDot: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "linear-gradient(135deg, #FF8DBB, #CBB7F6)",
    boxShadow: "0 8px 14px rgba(0,0,0,0.14)",
  };

  const navGroup: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  };

  const topBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(255,255,255,0.78)",
    borderRadius: 14,
    padding: "10px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: 950,
    color: ink,
  };

  const topBtnActive: React.CSSProperties = {
    ...topBtn,
    border: "1px solid rgba(0,0,0,0.22)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const topBtnPrimary: React.CSSProperties = {
    ...topBtn,
    background: "rgba(25,25,35,0.92)",
    color: "white",
    border: "1px solid rgba(0,0,0,0.10)",
  };

  const acctPill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.70)",
    border: "1px solid rgba(0,0,0,0.10)",
    fontWeight: 950,
    color: ink,
    whiteSpace: "nowrap",
  };

  return (
    <div style={topbar}>
      <div style={brandPill} onClick={() => onNavigate("home")} title="Go home">
        <span style={brandDot} />
        Ppopgi
      </div>

      <div style={navGroup}>
        <button
          style={page === "explore" ? topBtnActive : topBtn}
          onClick={() => {
            onNavigate("explore");
            onOpenExplore();
          }}
        >
          Explore
        </button>

        {account && (
          <button
            style={page === "dashboard" ? topBtnActive : topBtn}
            onClick={() => {
              onNavigate("dashboard");
              onOpenDashboard();
            }}
          >
            Dashboard
          </button>
        )}

        <button style={topBtnPrimary} onClick={onOpenCreate}>
          Create
        </button>
      </div>

      <div style={navGroup}>
        <button style={topBtn} onClick={onOpenCashier}>
          Cashier
        </button>

        {!account ? (
          <button style={topBtn} onClick={onOpenSignIn}>
            Sign in
          </button>
        ) : (
          <>
            <span style={acctPill} title={account}>
              <span style={{ opacity: 0.85 }}>Account</span>
              <b style={{ letterSpacing: 0.2 }}>{short(account)}</b>
            </span>
            <button style={topBtn} onClick={onSignOut}>
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}