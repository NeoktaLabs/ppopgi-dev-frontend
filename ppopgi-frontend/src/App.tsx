import { useSession } from "./state/useSession";
import { ensureEtherlink, signIn } from "./wallet/injected";
import { ETHERLINK_MAINNET } from "./chain/etherlink";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function App() {
  const { account, chainId, set, clear } = useSession();

  const wrongPlace = account && chainId !== ETHERLINK_MAINNET.chainId;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>Ppopgi</b>

        <div style={{ display: "flex", gap: 10 }}>
          <button>Explore</button>
          <button>Create</button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button>Cashier</button>

          {!account ? (
            <button
              onClick={async () => {
                try {
                  await ensureEtherlink();
                  const s = await signIn();
                  set(s);
                } catch (e: any) {
                  if (e?.message === "NO_WALLET") alert("Please install a wallet to sign in.");
                  else alert("Could not sign in. Please try again.");
                }
              }}
            >
              Sign in
            </button>
          ) : (
            <>
              <span>Your account: {short(account)}</span>
              <button onClick={clear}>Sign out</button>
            </>
          )}
        </div>
      </div>

      {wrongPlace && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 10 }}>
          This raffle booth runs on Etherlink. Please switch “where you play” to continue.
        </div>
      )}
    </div>
  );
}