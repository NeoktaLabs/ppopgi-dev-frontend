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

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

  const topBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(255,255,255,0.70)",
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

  // ✅ Sections: strong demarcation but still shows your background through
  const sectionCard: React.CSSProperties = {
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    position: "relative",
    overflow: "hidden",

    // See-through but NOT “washed out”
    background: "rgba(255, 247, 251, 0.78)",
    backdropFilter: "blur(10px)",

    border: "2px solid rgba(242, 166, 198, 0.95)",
    boxShadow: "0 14px 30px rgba(0,0,0,0.14), inset 0 0 0 2px rgba(255,255,255,0.55)",
  };

  const sectionAccent: React.CSSProperties = {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: 10,
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
    paddingLeft: 16, // space from accent stripe
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
    background: "rgba(255,255,255,0.92)",
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

  // ✅ single-row (always) list of 5 cards; scrolls on smaller widths
  const row5: React.CSSProperties = {
    marginTop: 12,
    paddingLeft: 16, // align with title
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
    // bigPrizes already = top3 active by prize desc (from hook), but we still map to gold/silver/bronze positions
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
    // Should remain active only (hook already filters active); keep soonest left
    return [...endingSoon].sort((a, b) => num(a.deadline) - num(b.deadline));
  }, [endingSoon]);

  const latestTerminated = useMemo(() => {
    const all = items ?? [];

    // “Latest terminated raffles” = anything NOT active (not OPEN / not FUNDING_PENDING)
    const terminated = all.filter((r) => r.status !== "OPEN" && r.status !== "FUNDING_PENDING");

    const sortKey = (r: any) => {
      // best-effort “most recent” key
      const finalizedAt = num(r.finalizedAt); // schema has it, your list item may not
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
            <div style={{ marginTop: 12, fontSize: 13, opacity: 0.92 }}>{homeNote}</div>
          )}
          {createdHint && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.95 }}>{createdHint}</div>}

          {/* HOME */}
          {page === "home" && (
            <>
              {/* BIG PRIZES */}
              <div style={sectionCard}>
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
                    paddingLeft: 16,
                    marginTop: 12,
                  }}
                >
                  <div className="pp-podium__silver">
                    {podium.silver ? <RaffleCard raffle={podium.silver} onOpen={openRaffle} ribbon="silver" /> : null}
                  </div>

                  <div className="pp-podium__gold">
                    {podium.gold ? <RaffleCard raffle={podium.gold} onOpen={openRaffle} ribbon="gold" /> : null}
                  </div>

                  <div className="pp-podium__bronze">
                    {podium.bronze ? <RaffleCard raffle={podium.bronze} onOpen={openRaffle} ribbon="bronze" /> : null}
                  </div>

                  {bigPrizes.length === 0 && (
                    <div style={{ opacity: 0.9, paddingLeft: 16 }}>No active raffles right now.</div>
                  )}
                </div>
              </div>

              {/* ENDING SOON */}
              <div style={sectionCard}>
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
                      <RaffleCard raffle={r} onOpen={openRaffle} />
                    </div>
                  ))}
                  {endingSoonSorted.length === 0 && (
                    <div style={{ opacity: 0.9, paddingLeft: 16 }}>Nothing is ending soon.</div>
                  )}
                </div>
              </div>

              {/* LATEST TERMINATED */}
              <div style={sectionCard}>
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
                      <RaffleCard raffle={r} onOpen={openRaffle} />
                    </div>
                  ))}
                  {latestTerminated.length === 0 && (
                    <div style={{ opacity: 0.9, paddingLeft: 16 }}>No terminated raffles to show yet.</div>
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