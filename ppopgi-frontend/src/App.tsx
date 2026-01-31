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
import {
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
  useAutoConnect,
} from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";

import { thirdwebClient } from "./thirdweb/client";
import { ETHERLINK_CHAIN } from "./thirdweb/etherlink";

// ✅ Safety modal + details loader
import { SafetyProofModal } from "./components/SafetyProofModal";
import { useRaffleDetails } from "./hooks/useRaffleDetails";

// ✅ Random backgrounds (picked once per page load)
import bg1 from "./assets/backgrounds/bg1.webp";
import bg2 from "./assets/backgrounds/bg2.webp";
import bg3 from "./assets/backgrounds/bg3.webp";

// ✅ Home layouts (podium + ticket rows)
import "./pages/homeTickets.css";

const BACKGROUNDS = [bg1, bg2, bg3];
const pickRandomBg = () => BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

function short(a: string) {
  if (!a) return "—";
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

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function App() {
  // ✅ Persist wallet session across refresh (thirdweb auto reconnect)
  // Keep the wallet list conservative (MetaMask first). Add others later if you want.
  useAutoConnect({
    client: thirdwebClient,
    chain: ETHERLINK_CHAIN,
    wallets: [createWallet("io.metamask")],
  });

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

  // Details modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);

  // ✅ Safety modal (opened from shield on card)
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyRaffleId, setSafetyRaffleId] = useState<string | null>(null);

  // ✅ load details for SafetyProofModal only when needed
  const { data: safetyData } = useRaffleDetails(safetyRaffleId, safetyOpen);

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

    // ✅ if safety is open, close it (avoid stacked modals)
    setSafetyOpen(false);
    setSafetyRaffleId(null);
  }

  function closeRaffle() {
    setDetailsOpen(false);
    setSelectedRaffleId(null);
    setRaffleQuery(null);
  }

  // ✅ Open safety from card shield
  function openSafety(id: string) {
    const addr = extractAddress(id) ?? id;

    // ✅ avoid stacking modals: close details first
    setDetailsOpen(false);
    setSelectedRaffleId(null);
    setRaffleQuery(null);

    setSafetyRaffleId(addr);
    setSafetyOpen(true);
  }

  function closeSafety() {
    setSafetyOpen(false);
    setSafetyRaffleId(null);
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
    backgroundAttachment: "fixed",
  };

  const overlay: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(900px 520px at 15% 10%, rgba(246,182,200,0.14), transparent 60%)," +
      "radial-gradient(900px 520px at 85% 5%, rgba(169,212,255,0.12), transparent 60%)," +
      "rgba(255,255,255,0.02)",
  };

  const container: React.CSSProperties = {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "18px 16px",
  };

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
    color: "#4A0F2B",
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

  const ink = "#4A0F2B";

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

  // ✅ “Glass border” section: keeps your background visible
  const sectionCard: React.CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))," +
      "radial-gradient(900px 240px at 10% 0%, rgba(255,141,187,0.10), rgba(255,141,187,0) 55%)," +
      "radial-gradient(900px 240px at 90% 0%, rgba(203,183,246,0.10), rgba(203,183,246,0) 55%)",
    backdropFilter: "blur(3px)",
    border: "2px solid rgba(255,255,255,0.55)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
  };

  const sectionInnerStroke: React.CSSProperties = {
    position: "absolute",
    inset: 6,
    borderRadius: 20,
    pointerEvents: "none",
    border: "1px solid rgba(242,166,198,0.55)",
  };

  const sectionAccent: React.CSSProperties = {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 12,
    width: 6,
    borderRadius: 999,
    background: "linear-gradient(180deg, #FF8DBB, #CBB7F6, #FFD89A)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  };

  const sectionTitleRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    paddingLeft: 18,
  };

  const sectionTitlePill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 1000 as any,
    fontSize: 16,
    letterSpacing: 0.25,
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(0,0,0,0.10)",
    color: "#4A0F2B",
    boxShadow: "0 10px 18px rgba(0,0,0,0.10)",
  };

  const sectionTitleNotch: React.CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(135deg, rgba(255,141,187,0.95), rgba(203,183,246,0.95))",
    boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
  };

  const row5: React.CSSProperties = {
    marginTop: 12,
    paddingLeft: 18,
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 8,
    scrollSnapType: "x mandatory",
  };

  const row5Item: React.CSSProperties = {
    scrollSnapAlign: "start",
    flex: "0 0 auto",
  };

  /* ───────────── render helpers ───────────── */

  const podium = useMemo(() => {
    const sorted = [...bigPrizes].sort((a, b) => {
      try {
        const A = BigInt(a.winningPot || "0");
        const B = BigInt(b.winningPot || "0");
        return A === B ? 0 : A < B ? 1 : -1;
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
    return [...endingSoon].sort((a, b) => num(a.deadline) - num(b.deadline));
  }, [endingSoon]);

  const latestTerminated = useMemo(() => {
    const all = items ?? [];
    const terminated = all.filter((r) => r.status !== "OPEN" && r.status !== "FUNDING_PENDING");

    const sortKey = (r: any) => {
      const finalizedAt = num(r.finalizedAt);
      const completedAt = num(r.completedAt);
      const canceledAt = num(r.canceledAt);
      const updated = num(r.lastUpdatedTimestamp);
      return Math.max(finalizedAt, completedAt, canceledAt, updated);
    };

    return terminated.sort((a: any, b: any) => sortKey(b) - sortKey(a)).slice(0, 5);
  }, [items]);

  return (
    <div style={pageBg}>
      <div style={overlay}>
        <div style={container}>
          <DisclaimerGate open={gateOpen} onAccept={onAcceptGate} />

          {/* ✅ Top bar (refit) */}
          <div style={topbar}>
            <div style={brandPill} onClick={() => setPage("home")} title="Go home">
              <span style={brandDot} />
              Ppopgi
            </div>

            <div style={navGroup}>
              <button
                style={page === "explore" ? topBtnActive : topBtn}
                onClick={() => setPage("explore")}
              >
                Explore
              </button>

              {account && (
                <button
                  style={page === "dashboard" ? topBtnActive : topBtn}
                  onClick={() => setPage("dashboard")}
                >
                  Dashboard
                </button>
              )}

              <button
                style={topBtnPrimary}
                onClick={() => (account ? setCreateOpen(true) : setSignInOpen(true))}
              >
                Create
              </button>
            </div>

            <div style={navGroup}>
              <button style={topBtn} onClick={() => setCashierOpen(true)}>
                Cashier
              </button>

              {!account ? (
                <button style={topBtn} onClick={() => setSignInOpen(true)}>
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

          {page === "home" && homeNote && (
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.92 }}>{homeNote}</div>
          )}
          {createdHint && (
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.95 }}>{createdHint}</div>
          )}

          {/* HOME */}
          {page === "home" && (
            <>
              {/* BIG PRIZES */}
              <div style={sectionCard}>
                <div style={sectionInnerStroke} />
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    🏆 Big prizes right now
                  </div>
                </div>

                <div
                  className="pp-podium"
                  style={{
                    justifyContent: "center",
                    paddingLeft: 18,
                    marginTop: 12,
                  }}
                >
                  <div className="pp-podium__silver">
                    {podium.silver ? (
                      <RaffleCard
                        raffle={podium.silver}
                        onOpen={openRaffle}
                        onOpenSafety={openSafety}
                        ribbon="silver"
                      />
                    ) : null}
                  </div>

                  <div className="pp-podium__gold">
                    {podium.gold ? (
                      <RaffleCard
                        raffle={podium.gold}
                        onOpen={openRaffle}
                        onOpenSafety={openSafety}
                        ribbon="gold"
                      />
                    ) : null}
                  </div>

                  <div className="pp-podium__bronze">
                    {podium.bronze ? (
                      <RaffleCard
                        raffle={podium.bronze}
                        onOpen={openRaffle}
                        onOpenSafety={openSafety}
                        ribbon="bronze"
                      />
                    ) : null}
                  </div>

                  {bigPrizes.length === 0 && (
                    <div style={{ opacity: 0.9, paddingLeft: 18 }}>
                      No active raffles right now.
                    </div>
                  )}
                </div>
              </div>

              {/* ENDING SOON */}
              <div style={sectionCard}>
                <div style={sectionInnerStroke} />
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    ⏳ Ending soon
                  </div>
                </div>

                <div style={row5}>
                  {endingSoonSorted.map((r) => (
                    <div key={r.id} style={row5Item}>
                      <RaffleCard raffle={r} onOpen={openRaffle} onOpenSafety={openSafety} />
                    </div>
                  ))}
                  {endingSoonSorted.length === 0 && (
                    <div style={{ opacity: 0.9, paddingLeft: 18 }}>
                      Nothing is ending soon.
                    </div>
                  )}
                </div>
              </div>

              {/* LATEST TERMINATED */}
              <div style={sectionCard}>
                <div style={sectionInnerStroke} />
                <div style={sectionAccent} />
                <div style={sectionTitleRow}>
                  <div style={sectionTitlePill}>
                    <span style={sectionTitleNotch} />
                    🧾 Latest terminated raffles
                  </div>
                </div>

                <div style={row5}>
                  {latestTerminated.map((r) => (
                    <div key={r.id} style={row5Item}>
                      <RaffleCard raffle={r} onOpen={openRaffle} onOpenSafety={openSafety} />
                    </div>
                  ))}
                  {latestTerminated.length === 0 && (
                    <div style={{ opacity: 0.9, paddingLeft: 18 }}>
                      No terminated raffles to show yet.
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
          <CreateRaffleModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={onCreatedRaffle}
          />
          <RaffleDetailsModal open={detailsOpen} raffleId={selectedRaffleId} onClose={closeRaffle} />

          {/* ✅ Safety modal (from card shield) */}
          {safetyOpen && safetyData ? (
            <SafetyProofModal open={safetyOpen} onClose={closeSafety} raffle={safetyData} />
          ) : null}

          <CashierModal open={cashierOpen} onClose={() => setCashierOpen(false)} />
        </div>
      </div>
    </div>
  );
}