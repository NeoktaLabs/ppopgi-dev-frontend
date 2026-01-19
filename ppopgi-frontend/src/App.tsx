// src/App.tsx
import React, { useEffect, useState } from "react";
import { useSession } from "./state/useSession";
import { SignInModal } from "./components/SignInModal";
import { DisclaimerGate } from "./components/DisclaimerGate";
import { CreateRaffleModal } from "./components/CreateRaffleModal";
import { acceptDisclaimer, hasAcceptedDisclaimer } from "./state/disclaimer";
import { useHomeRaffles } from "./hooks/useHomeRaffles";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatDeadline(seconds: string) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return "Unknown time";
  return new Date(n * 1000).toLocaleString();
}

export default function App() {
  const account = useSession((s) => s.account);
  const clear = useSession((s) => s.clear);

  const [signInOpen, setSignInOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setGateOpen(!hasAcceptedDisclaimer());
  }, []);

  function onAcceptGate() {
    acceptDisclaimer();
    setGateOpen(false);
  }

  const { bigPrizes, endingSoon, note } = useHomeRaffles();

  return (
    <div style={{ padding: 20 }}>
      <DisclaimerGate open={gateOpen} onAccept={onAcceptGate} />

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>Ppopgi</b>

        <div style={{ display: "flex", gap: 10 }}>
          <button>Explore</button>
          <button onClick={() => setCreateOpen(true)}>Create</button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button>Cashier</button>

          {!account ? (
            <button onClick={() => setSignInOpen(true)}>Sign in</button>
          ) : (
            <>
              <span>Your account: {short(account)}</span>
              <button onClick={clear}>Sign out</button>
            </>
          )}
        </div>
      </div>

      {/* Calm fallback note */}
      {note && (
        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
          {note}
        </div>
      )}

      {/* Home sections (read-only) */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Big prizes right now</h3>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {bigPrizes.map((r) => (
            <div key={r.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                Win: {r.winningPot} USDC • Ticket: {r.ticketPrice} USDC
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                Joined: {r.sold}
                {r.maxTickets !== "0" ? ` • Max: ${r.maxTickets}` : ""}
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                Ppopgi fee: {r.protocolFeePercent}%
              </div>
            </div>
          ))}
          {bigPrizes.length === 0 && <div style={{ opacity: 0.8 }}>No open raffles right now.</div>}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <h3 style={{ margin: 0 }}>Ending soon</h3>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {endingSoon.map((r) => (
            <div key={r.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                Ticket: {r.ticketPrice} USDC
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                Ends at: {formatDeadline(r.deadline)}
              </div>
            </div>
          ))}
          {endingSoon.length === 0 && <div style={{ opacity: 0.8 }}>Nothing is ending soon.</div>}
        </div>
      </div>

      {/* Modals */}
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      <CreateRaffleModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}