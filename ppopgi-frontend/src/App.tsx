// src/App.tsx
import React, { useEffect, useState } from "react";
import { useSession } from "./state/useSession";
import { SignInModal } from "./components/SignInModal";
import { DisclaimerGate } from "./components/DisclaimerGate";
import { CreateRaffleModal } from "./components/CreateRaffleModal";
import { RaffleDetailsModal } from "./components/RaffleDetailsModal";
import { RaffleCard } from "./components/RaffleCard";
import { CashierModal } from "./components/CashierModal";
import { acceptDisclaimer, hasAcceptedDisclaimer } from "./state/disclaimer";
import { useHomeRaffles } from "./hooks/useHomeRaffles";
import { ExplorePage } from "./pages/ExplorePage";
import { DashboardPage } from "./pages/DashboardPage";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type Page = "home" | "explore" | "dashboard";

function extractAddress(input: string): string | null {
  if (!input) return null;
  const m = input.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0] : null;
}

function getRaffleFromQuery(): string | null {
  try {
    const url = new URL(window.location.href);
    const v = url.searchParams.get("raffle");
    const addr = extractAddress(v || "");
    return addr;
  } catch {
    return null;
  }
}

function setRaffleQuery(id: string | null) {
  try {
    const url = new URL(window.location.href);

    // ✅ keep ONLY raffle param (and no hash)
    url.hash = "";

    if (!id) {
      url.search = "";
    } else {
      url.search = "";
      url.searchParams.set("raffle", id);
    }

    window.history.pushState({}, "", url.toString());
  } catch {
    // ignore
  }
}

export default function App() {
  // zustand session is a mirror only
  const setSession = useSession((s) => s.set);
  const clearSession = useSession((s) => s.clear);

  // thirdweb is source of truth
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const account = activeAccount?.address ?? null;

  const [page, setPage] = useState<Page>("home");

  const [signInOpen, setSignInOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cashierOpen, setCashierOpen] = useState(false);
  const [createdHint, setCreatedHint] = useState<string | null>(null);

  // raffle details modal state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);

  useEffect(() => {
    setGateOpen(!hasAcceptedDisclaimer());
  }, []);

  function onAcceptGate() {
    acceptDisclaimer();
    setGateOpen(false);
  }

  // keep Zustand session in sync with thirdweb (NO chainId)
  useEffect(() => {
    if (!account) {
      setSession({ account: null, connector: null });
      return;
    }
    setSession({ account, connector: "thirdweb" });
  }, [account, setSession]);

  // If user signs out while on dashboard, move them to home (so UI can’t get stuck)
  useEffect(() => {
    if (page === "dashboard" && !account) setPage("home");
  }, [page, account]);

  const { bigPrizes, endingSoon, note: homeNote, refetch: refetchHome } = useHomeRaffles();

  function onCreatedRaffle() {
    setCreatedHint("Raffle created. It may take a moment to appear.");
    refetchHome();
    window.setTimeout(() => refetchHome(), 3500);
  }

  function openRaffle(id: string) {
    const addr = extractAddress(id) ?? id;
    setSelectedRaffleId(addr);
    setDetailsOpen(true);

    // ✅ reflect in URL as ?raffle=0x...
    setRaffleQuery(addr);
  }

  function closeRaffle() {
    setDetailsOpen(false);
    setSelectedRaffleId(null);

    // ✅ remove query param
    setRaffleQuery(null);
  }

  // ✅ Auto-open from URL (?raffle=0x...)
  useEffect(() => {
    const fromQuery = getRaffleFromQuery();
    if (fromQuery) {
      setSelectedRaffleId(fromQuery);
      setDetailsOpen(true);
    }

    const onPop = () => {
      const p = getRaffleFromQuery();
      if (p) {
        setSelectedRaffleId(p);
        setDetailsOpen(true);
      } else {
        setDetailsOpen(false);
        setSelectedRaffleId(null);
      }
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function onSignOut() {
    try {
      if (activeWallet) disconnect(activeWallet);
    } catch {
      // ignore
    }
    clearSession();
    setCreatedHint(null);
  }

  const topBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.65)",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
  };

  const topBtnActive: React.CSSProperties = {
    ...topBtn,
    fontWeight: 800,
    border: "1px solid rgba(0,0,0,0.28)",
  };

  const sectionWrap: React.CSSProperties = { marginTop: 18 };
  const grid: React.CSSProperties = { marginTop: 8, display: "grid", gap: 10 };

  return (
    <div style={{ padding: 20 }}>
      <DisclaimerGate open={gateOpen} onAccept={onAcceptGate} />

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b style={{ cursor: "pointer" }} onClick={() => setPage("home")}>
          Ppopgi
        </b>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={page === "explore" ? topBtnActive : topBtn} onClick={() => setPage("explore")}>
            Explore
          </button>

          {account && (
            <button
              style={page === "dashboard" ? topBtnActive : topBtn}
              onClick={() => setPage("dashboard")}
              title="Your created + joined raffles"
            >
              Dashboard
            </button>
          )}

          <button style={topBtn} onClick={() => (account ? setCreateOpen(true) : setSignInOpen(true))}>
            Create
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={topBtn} onClick={() => setCashierOpen(true)}>
            Cashier
          </button>

          {!account ? (
            <button style={topBtn} onClick={() => setSignInOpen(true)}>
              Sign in
            </button>
          ) : (
            <>
              <span style={{ fontSize: 13, opacity: 0.9 }}>Your account: {short(account)}</span>
              <button style={topBtn} onClick={onSignOut}>
                Sign out
              </button>
            </>
          )}
        </div>
      </div>

      {/* Home-only note (ExplorePage shows its own note inside) */}
      {page === "home" && homeNote && (
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>{homeNote}</div>
      )}

      {createdHint && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>{createdHint}</div>}

      {/* HOME */}
      {page === "home" && (
        <>
          <div style={sectionWrap}>
            <h3 style={{ margin: 0 }}>Big prizes right now</h3>
            <div style={grid}>
              {bigPrizes.map((r) => (
                <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
              ))}
              {bigPrizes.length === 0 && <div style={{ opacity: 0.8 }}>No open raffles right now.</div>}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <h3 style={{ margin: 0 }}>Ending soon</h3>
            <div style={grid}>
              {endingSoon.map((r) => (
                <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
              ))}
              {endingSoon.length === 0 && <div style={{ opacity: 0.8 }}>Nothing is ending soon.</div>}
            </div>
          </div>
        </>
      )}

      {/* EXPLORE */}
      {page === "explore" && <ExplorePage onOpenRaffle={openRaffle} />}

      {/* DASHBOARD */}
      {page === "dashboard" && <DashboardPage account={account} onOpenRaffle={openRaffle} />}

      {/* Modals */}
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onCreatedRaffle} />

      <RaffleDetailsModal open={detailsOpen} raffleId={selectedRaffleId} onClose={closeRaffle} />

      <CashierModal open={cashierOpen} onClose={() => setCashierOpen(false)} />
    </div>
  );
}