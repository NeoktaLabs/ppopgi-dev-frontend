// src/App.tsx
import React, { useEffect, useState } from "react";
import { useSession } from "./state/useSession";
import { SignInModal } from "./components/SignInModal";
import { DisclaimerGate } from "./components/DisclaimerGate";
import { CreateRaffleModal } from "./components/CreateRaffleModal";
import { acceptDisclaimer, hasAcceptedDisclaimer } from "./state/disclaimer";
import { useHomeRaffles } from "./hooks/useHomeRaffles";
import { useChainGuard } from "./chain/useChainGuard";

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

  // ✅ authoritative chain state (thirdweb)
  const { isOnEtherlink, expectedChain, activeChainId, switchToEtherlink } = useChainGuard();

  // Only show "wrong place" if user is signed in
  const wrongPlace = !!account && !isOnEtherlink;

  const [switchBusy, setSwitchBusy] = useState(false);
  const [switchMsg, setSwitchMsg] = useState<string | null>(null);

  async function onSwitchWhereYouPlay() {
    setSwitchMsg(null);
    setSwitchBusy(true);
    try {
      await switchToEtherlink();
    } catch {
      // Keep it calm + plain-language (no technical wording)
      setSwitchMsg("Could not switch where you play. You can switch inside your sign-in app.");
    } finally {
      setSwitchBusy(false);
    }
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

      {/* Wrong place notice (authoritative) */}
      {wrongPlace && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.35)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div style={{ color: "#2B2B33", lineHeight: 1.35 }}>
            This raffle booth runs on <b>{expectedChain.chainName}</b>. Please switch “where you play”
            to continue.
          </div>

          {/* optional: tiny debug hint (still non-technical) */}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, color: "#2B2B33" }}>
            Current place ID: {activeChainId ?? "Unknown"}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={onSwitchWhereYouPlay}
              disabled={switchBusy}
              style={{
                border: "1px solid rgba(255,255,255,0.45)",
                background: "rgba(255,255,255,0.22)",
                borderRadius: 12,
                padding: "8px 10px",
                cursor: switchBusy ? "not-allowed" : "pointer",
                color: "#2B2B33",
                opacity: switchBusy ? 0.65 : 1,
              }}
            >
              {switchBusy ? "Switching…" : "Switch where you play"}
            </button>

            {switchMsg && (
              <span style={{ fontSize: 13, opacity: 0.85, color: "#2B2B33" }}>{switchMsg}</span>
            )}
          </div>
        </div>
      )}

      {/* Calm fallback note */}
      {note && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>{note}</div>}

      {/* Home sections */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: 0 }}>Big prizes right now</h3>
        <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
          {bigPrizes.map((r) => (
            <div
              key={r.id}
              style={{
                padding: 12,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
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
            <div
              key={r.id}
              style={{
                padding: 12,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
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