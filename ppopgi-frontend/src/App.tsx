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

  const { items, bigPrizes, endingSoon, note: homeNote, refetch } = useHomeRaffles();

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

  // “section” card wrapper (clear separation, matches raffle-card vibe)
  const sectionCard: React.CSSProperties = {
    marginTop: 18,
    borderRadius: 22,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.62)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.50), rgba(255,255,255,0.18) 55%, rgba(255,255,255,0.22))",
    boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
    backdropFilter: "blur(12px)",
  };

  const sectionTitleRow: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  };

  const sectionTitlePill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "#4A0F2B",
    fontWeight: 950,
    letterSpacing: 0.35,
    textTransform: "uppercase",
    fontSize: 12,
  };

  const sectionSub: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.78,
    color: "#4A0F2B",
    whiteSpace: "nowrap",
  };

  const homeMeta: React.CSSProperties = {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.9,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.60)",
    border: "1px solid rgba(0,0,0,0.06)",
    backdropFilter: "blur(10px)",
  };

  /* ───────────── render helpers ───────────── */

  const podium = useMemo(() => {
    // Sort by winningPot descending (BigInt safe)
    const sorted = [...bigPrizes].sort((a, b) => {
      try {
        const A = BigInt(a.winningPot || "0");
        const B = BigInt(b.winningPot || "0");
        return A === B ? 0 : A < B ? 1 : -1; // desc
      } catch {
        return 0;
      }
    });

    const top3 = sorted.slice(0, 3);
    return {
      gold: top3[0] || null,
      silver: top3[1] || null,
      bronze: top3[2] || null,
    };
  }, [bigPrizes]);

  const endingSoonSorted = useMemo(() => {
    // Soonest deadline on the left
    return [...endingSoon].sort((a, b) => Number(a.deadline || "0") - Number(b.deadline || "0"));
  }, [endingSoon]);

  // ✅ NEW: Recently settled (top 5, most recent on the left)
  const recentlySettled = useMemo(() => {
    const all = items ?? [];
    return [...all]
      .filter((r) => r.status === "COMPLETED")
      .sort((a, b) => Number(b.completedAt || "0") - Number(a.completedAt || "0"))
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

          {page === "home" && homeNote && <div style={homeMeta}>{homeNote}</div>}
          {createdHint && <div style={homeMeta}>{createdHint}</div>}

          {/* HOME */}
          {page === "home" && (
            <>
              {/* Big prizes */}
              <div style={sectionCard}>
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>🏆 Big prizes right now</div>
                  <div style={sectionSub}>Top 3 by prize pool</div>
                </div>

                <div className="pp-podium">
                  <div className="pp-podium__silver">
                    {podium.silver ? <RaffleCard raffle={podium.silver} onOpen={openRaffle} ribbon="silver" /> : null}
                  </div>

                  <div className="pp-podium__gold">
                    {podium.gold ? <RaffleCard raffle={podium.gold} onOpen={openRaffle} ribbon="gold" /> : null}
                  </div>

                  <div className="pp-podium__bronze">
                    {podium.bronze ? <RaffleCard raffle={podium.bronze} onOpen={openRaffle} ribbon="bronze" /> : null}
                  </div>

                  {bigPrizes.length === 0 && <div style={{ opacity: 0.85 }}>No open raffles right now.</div>}
                </div>
              </div>

              {/* Ending soon */}
              <div style={sectionCard}>
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>⏳ Ending soon</div>
                  <div style={sectionSub}>Soonest deadlines first</div>
                </div>

                <div className="pp-rowTickets">
                  {endingSoonSorted.map((r) => (
                    <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
                  ))}
                  {endingSoonSorted.length === 0 && <div style={{ opacity: 0.85 }}>Nothing is ending soon.</div>}
                </div>
              </div>

              {/* ✅ NEW: Recently finalized (settled) */}
              <div style={sectionCard}>
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>✨ Recently settled</div>
                  <div style={sectionSub}>Latest settlements first</div>
                </div>

                <div className="pp-rowTickets">
                  {recentlySettled.map((r) => (
                    <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
                  ))}
                  {recentlySettled.length === 0 && (
                    <div style={{ opacity: 0.85 }}>No raffles have been settled recently.</div>
                  )}
                </div>
              </div>

              {/* tiny suggestion space (optional / harmless) */}
              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.78, paddingLeft: 2 }}>
                Tip: tap any ticket to see details, participants, and history.
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