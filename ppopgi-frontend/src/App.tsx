// src/App.tsx
import React, { useEffect, useState } from "react";
import { useSession } from "./state/useSession";
import { SignInModal } from "./components/SignInModal";
import { DisclaimerGate } from "./components/DisclaimerGate";
import { CreateRaffleModal } from "./components/CreateRaffleModal";
import { RaffleDetailsModal } from "./components/RaffleDetailsModal";
import { RaffleCard } from "./components/RaffleCard";
import { acceptDisclaimer, hasAcceptedDisclaimer } from "./state/disclaimer";
import { useHomeRaffles } from "./hooks/useHomeRaffles";

import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
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

  const [signInOpen, setSignInOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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

  const { bigPrizes, endingSoon, note, refetch } = useHomeRaffles();

  function onCreatedRaffle() {
    setCreatedHint("Raffle created. It may take a moment to appear on the home page.");
    refetch();
    window.setTimeout(() => refetch(), 3500);
  }

  function openRaffle(id: string) {
    setSelectedRaffleId(id);
    setDetailsOpen(true);
  }

  async function onSignOut() {
    try {
      if (activeWallet) disconnect(activeWallet);
    } catch {
      // ignore
    }
    clearSession();
    setCreatedHint(null);
  }

  return (
    <div style={{ padding: 20 }}>
      <DisclaimerGate open={gateOpen} onAccept={onAcceptGate} />

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>Ppopgi</b>

        <div style={{ display: "flex", gap: 10 }}>
          <button>Explore</button>

          <button onClick={() => (account ? setCreateOpen(true) : setSignInOpen(true))}>
            Create
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button>Cashier</button>

          {!account ? (
            <button onClick={() => setSignInOpen(true)}>Sign in</button>
          ) : (
            <>
              <span>Your account: {short(account)}</span>
              <button onClick={onSignOut}>Sign out</button>
            </>
          )}
        </div>
      </div>

      {note && (
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
          {note}
        </div>
      )}

      {createdHint && (
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
          {createdHint}
        </div>
      )}

      {/* Home sections */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Big prizes right now</h3>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {bigPrizes.map((r) => (
            <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
          ))}
          {bigPrizes.length === 0 && <div style={{ opacity: 0.8 }}>No open raffles right now.</div>}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <h3 style={{ margin: 0 }}>Ending soon</h3>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {endingSoon.map((r) => (
            <RaffleCard key={r.id} raffle={r} onOpen={openRaffle} />
          ))}
          {endingSoon.length === 0 && <div style={{ opacity: 0.8 }}>Nothing is ending soon.</div>}
        </div>
      </div>

      {/* Modals */}
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />

      <CreateRaffleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreatedRaffle}
      />

      <RaffleDetailsModal
        open={detailsOpen}
        raffleId={selectedRaffleId}
        onClose={() => setDetailsOpen(false)}
      />
    </div>
  );
}