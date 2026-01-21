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

// ✅ Home layouts (podium + ticket rows)
import "./pages/homeTickets.css";

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
  } catch {
    // ignore
  }
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

  // ✅ bigPrizes + endingSoon are already derived from ACTIVE in your hook
  const { items, bigPrizes, endingSoon, mode, note: homeNote, refetch } = useHomeRaffles();

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
    } catch {
      // ignore
    }
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
    maxWidth: 1400,
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

  // ✅ Stronger section delimitation
  const sectionCard: React.CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
    border: "1px solid rgba(255,255,255,0.22)",
    boxShadow:
      "0 18px 44px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.18)",
    backdropFilter: "blur(10px)",
    position: "relative",
    overflow: "hidden",
  };

  // top accent like a “ticket edge”
  const sectionAccent: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    background:
      "linear-gradient(90deg, rgba(255,190,215,0.85), rgba(203,183,246,0.70), rgba(255,216,154,0.65))",
    opacity: 0.85,
  };

  const sectionTitleRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  };

  // ✅ More visible title pill
  const sectionTitlePill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    fontSize: 15,
    letterSpacing: 0.25,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72))",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "#4A0F2B",
    boxShadow: "0 14px 28px rgba(0,0,0,0.16)",
  };

  const sectionTitleNotch: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(255,190,215,0.95)",
    boxShadow: "0 6px 14px rgba(0,0,0,0.14)",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  /* ───────────── render helpers ───────────── */

  // Podium (top 3 active by prize) — already active-derived
  const podium = useMemo(() => {
    const top3 = [...(bigPrizes ?? [])].slice(0, 3);
    return {
      gold: top3[0] || null,
      silver: top3[1] || null,
      bronze: top3[2] || null,
    };
  }, [bigPrizes]);

  // Ending soon (top 5 OPEN by deadline asc) — already active-derived, keep sorted for safety
  const endingSoonSorted = useMemo(() => {
    return [...(endingSoon ?? [])]
      .sort((a, b) => Number(a.deadline || "0") - Number(b.deadline || "0"))
      .slice(0, 5);
  }, [endingSoon]);

  // Latest terminated = ANY not OPEN (canceled / completed / drawing / funding_pending etc.)
  const latestTerminated = useMemo(() => {
    const all = items ?? [];

    const ts = (r: any) => {
      const a = Number(r.completedAt || "0");
      const b = Number(r.canceledAt || "0");
      const c = Number(r.lastUpdatedTimestamp || "0");
      return Math.max(a, b, c);
    };

    return [...all]
      .filter((r) => r.status !== "OPEN")
      .sort((a, b) => ts(b) - ts(a))
      .slice(0, 5);
  }, [items]);

  return (
    <div style={pageBg}>
      <div style={overlay}>
        <div style={container}>
          <DisclaimerGate open={gateOpen} onAccept={onAcceptGate} />

          {/* Top bar */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
            <b style={{ cursor: "pointer", userSelect: "none" }} onClick={() => setPage("home")} title="Go home">
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

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button style={topBtn} onClick={() => setCashierOpen(true)}>
                Cashier
              </button>
              {!account ? (
                <button style={topBtn} onClick={() => setSignInOpen(true)}>
                  Sign in
                </button>
              ) : (
                <>
                  <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>Your account: {short(account)}</span>
                  <button style={topBtn} onClick={onSignOut}>
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>

          {page === "home" && homeNote && (
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>{homeNote}</div>
          )}
          {createdHint && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.92 }}>{createdHint}</div>}

          {/* HOME */}
          {page === "home" && (
            <>
              {/* BIG PRIZES (ACTIVE ONLY) */}
              <div style={sectionCard}>
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    🏆 Big prizes right now
                  </div>
                </div>

                <div className="pp-podium" style={{ justifyContent: "center" }}>
                  <div className="pp-podium__silver">
                    {podium.silver ? <RaffleCard raffle={podium.silver} onOpen={openRaffle} ribbon="silver" /> : null}
                  </div>

                  <div className="pp-podium__gold">
                    {podium.gold ? <RaffleCard raffle={podium.gold} onOpen={openRaffle} ribbon="gold" /> : null}
                  </div>

                  <div className="pp-podium__bronze">
                    {podium.bronze ? <RaffleCard raffle={podium.bronze} onOpen={openRaffle} ribbon="bronze" /> : null}
                  </div>

                  {(bigPrizes?.length ?? 0) === 0 && <div style={{ opacity: 0.9 }}>No open raffles right now.</div>}
                </div>
              </div>

              {/* ENDING SOON (ACTIVE ONLY) */}
              <div style={sectionCard}>
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    ⏳ Ending soon
                  </div>
                </div>

                <div className="pp-rowTickets">
                  {endingSoonSorted.map((r) => (
                    <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
                  ))}
                  {endingSoonSorted.length === 0 && <div style={{ opacity: 0.9 }}>Nothing is ending soon.</div>}
                </div>
              </div>

              {/* LATEST TERMINATED (NOT OPEN) */}
              <div style={sectionCard}>
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    🧾 Latest terminated raffles
                  </div>
                </div>

                <div className="pp-rowTickets">
                  {latestTerminated.map((r) => (
                    <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
                  ))}

                  {latestTerminated.length === 0 && (
                    <div style={{ opacity: 0.9 }}>
                      {mode === "live" ? "Live mode may not include past raffles yet." : "No terminated raffles found yet."}
                    </div>
                  )}
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
      </div>
    </div>
  );
}