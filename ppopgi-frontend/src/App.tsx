// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
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

// ✅ Random backgrounds (picked once per page load)
import bg1 from "./assets/backgrounds/bg1.webp";
import bg2 from "./assets/backgrounds/bg2.webp";
import bg3 from "./assets/backgrounds/bg3.webp";

const BACKGROUNDS = [bg1, bg2, bg3];
const pickRandomBg = () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type Page = "home" | "explore" | "dashboard";

function extractAddress(input: string): string | null {
  const m = input?.match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0] : null;
}

function getRaffleFromQuery(): string | null {
  try {
    const url = new URL(window.location.href);
    return extractAddress(url.searchParams.get("raffle") || "");
  } catch {
    return null;
  }
}

function setRaffleQuery(id: string | null) {
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    if (id) url.searchParams.set("raffle", id);
    window.history.pushState({}, "", url.toString());
  } catch {}
}

export default function App() {
  const chosenBg = useMemo(pickRandomBg, []);

  const setSession = useSession((s) => s.set);
  const clearSession = useSession((s) => s.clear);

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);

  useEffect(() => setGateOpen(!hasAcceptedDisclaimer()), []);
  const onAcceptGate = () => {
    acceptDisclaimer();
    setGateOpen(false);
  };

  useEffect(() => {
    if (!account) setSession({ account: null, connector: null });
    else setSession({ account, connector: "thirdweb" });
  }, [account, setSession]);

  useEffect(() => {
    if (page === "dashboard" && !account) setPage("home");
  }, [page, account]);

  const { bigPrizes, endingSoon, note: homeNote, refetch } = useHomeRaffles();

  function onCreatedRaffle() {
    setCreatedHint("Raffle created. It may take a moment to appear.");
    refetch();
    setTimeout(refetch, 3500);
  }

  function openRaffle(id: string) {
    const addr = extractAddress(id) ?? id;
    setSelectedRaffleId(addr);
    setDetailsOpen(true);
    setRaffleQuery(addr);
  }

  function closeRaffle() {
    setDetailsOpen(false);
    setSelectedRaffleId(null);
    setRaffleQuery(null);
  }

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
    } catch {}
    clearSession();
    setCreatedHint(null);
  }

  /* ───────────── styles ───────────── */

  const pageBg: React.CSSProperties = {
    minHeight: "100vh",
    backgroundImage: `url(${chosenBg})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  const overlay: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 520px at 15% 10%, rgba(246,182,200,0.18), transparent 60%)," +
      "radial-gradient(900px 520px at 85% 5%, rgba(169,212,255,0.16), transparent 60%)," +
      "rgba(255,255,255,0.04)",
  };

  const container: React.CSSProperties = {
    maxWidth: 1400,              // ← desktop width (adjust freely)
    margin: "0 auto",
    padding: "18px 16px",
  };

  const topBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.65)",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const topBtnActive: React.CSSProperties = {
    ...topBtn,
    fontWeight: 800,
    border: "1px solid rgba(0,0,0,0.28)",
  };

  /* ───────────── render ───────────── */

  return (
    <div style={pageBg}>
      <div style={overlay}>
        <div style={container}>
          <DisclaimerGate open={gateOpen} onAccept={onAcceptGate} />

          {/* Top bar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
            <b style={{ cursor: "pointer" }} onClick={() => setPage("home")}>
              Ppopgi
            </b>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={page === "explore" ? topBtnActive : topBtn} onClick={() => setPage("explore")}>
                Explore
              </button>
              {account && (
                <button style={page === "dashboard" ? topBtnActive : topBtn} onClick={() => setPage("dashboard")}>
                  Dashboard
                </button>
              )}
              <button style={topBtn} onClick={() => (account ? setCreateOpen(true) : setSignInOpen(true))}>
                Create
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={topBtn} onClick={() => setCashierOpen(true)}>
                Cashier
              </button>
              {!account ? (
                <button style={topBtn} onClick={() => setSignInOpen(true)}>
                  Sign in
                </button>
              ) : (
                <>
                  <span style={{ fontSize: 13 }}>Your account: {short(account)}</span>
                  <button style={topBtn} onClick={onSignOut}>
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>

          {page === "home" && homeNote && <div style={{ marginTop: 12 }}>{homeNote}</div>}
          {createdHint && <div style={{ marginTop: 12 }}>{createdHint}</div>}

          {page === "home" && (
            <>
              <h3>Big prizes right now</h3>
              {bigPrizes.map((r) => (
                <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
              ))}

              <h3 style={{ marginTop: 22 }}>Ending soon</h3>
              {endingSoon.map((r) => (
                <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
              ))}
            </>
          )}

          {page === "explore" && <ExplorePage onOpenRaffle={openRaffle} />}
          {page === "dashboard" && <DashboardPage account={account} onOpenRaffle={openRaffle} />}

          <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
          <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onCreatedRaffle} />
          <RaffleDetailsModal open={detailsOpen} raffleId={selectedRaffleId} onClose={closeRaffle} />
          <CashierModal open={cashierOpen} onClose={() => setCashierOpen(false)} />
        </div>
      </div>
    </div>
  );
}