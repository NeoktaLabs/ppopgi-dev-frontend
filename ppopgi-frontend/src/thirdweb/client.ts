// src/wallet/connect.ts
import { BrowserProvider } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";
import { ETHERLINK_MAINNET } from "../chain/etherlink";

type Eip1193Provider = {
  request: (args: { method: string; params?: any }) => Promise<any>;
  on?: (event: string, cb: (...args: any[]) => void) => void;
  removeListener?: (event: string, cb: (...args: any[]) => void) => void;
};

function getInjected(): Eip1193Provider | null {
  return (window as any).ethereum ?? null;
}

export async function connectInjected() {
  const eth = getInjected();
  if (!eth) throw new Error("NO_INJECTED");

  await eth.request({ method: "eth_requestAccounts" });

  const provider = new BrowserProvider(eth as any);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const network = await provider.getNetwork();

  return { provider, signer, account, chainId: Number(network.chainId) };
}

function hexChainId(chainId: number) {
  return "0x" + chainId.toString(16);
}

/**
 * Best-effort chain switch/add.
 * IMPORTANT: This must never break sign-in for WalletConnect users.
 * Some wallets refuse switch/add over QR sessions.
 */
async function ensureEtherlinkBestEffort(eip1193: any): Promise<boolean> {
  const targetHex = hexChainId(ETHERLINK_MAINNET.chainId);
  const rpcUrl = import.meta.env.VITE_ETHERLINK_RPC_URL as string;
  if (!rpcUrl) return false;

  try {
    await eip1193.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
    return true;
  } catch (e: any) {
    const is4902 = e?.code === 4902 || String(e?.message || "").includes("4902");
    if (!is4902) return false;

    try {
      await eip1193.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: targetHex,
            chainName: ETHERLINK_MAINNET.chainName,
            rpcUrls: [rpcUrl],
            nativeCurrency: { name: "XTZ", symbol: "XTZ", decimals: 18 },
            blockExplorerUrls: ["https://explorer.etherlink.com"],
          },
        ],
      });

      await eip1193.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetHex }],
      });

      return true;
    } catch {
      return false;
    }
  }
}

function waitForChain(eip1193: any, targetChainId: number, ms = 20000) {
  return new Promise<void>((resolve, reject) => {
    const onChain = (hexId: string) => {
      const id = typeof hexId === "number" ? hexId : Number.parseInt(hexId, 16);
      if (id === targetChainId) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      try {
        eip1193.removeListener?.("chainChanged", onChain);
      } catch {}
      clearTimeout(t);
    };

    const t = setTimeout(() => {
      cleanup();
      reject(new Error("CHAIN_SWITCH_TIMEOUT"));
    }, ms);

    eip1193
      .request({ method: "eth_chainId" })
      .then((hexId: string) => {
        const id = typeof hexId === "number" ? hexId : Number.parseInt(hexId, 16);
        if (id === targetChainId) {
          cleanup();
          resolve();
        } else {
          eip1193.on?.("chainChanged", onChain);
        }
      })
      .catch(() => {
        eip1193.on?.("chainChanged", onChain);
      });
  });
}

async function ensureAccountsHydrated(eip1193: any) {
  try {
    const accts = (await eip1193.request({ method: "eth_accounts" })) as string[];
    if (accts?.length) return;
  } catch {}

  await eip1193.request({ method: "eth_requestAccounts" });
}

async function getChainId(eip1193: any): Promise<number> {
  const v = await eip1193.request({ method: "eth_chainId" });
  const hex = typeof v === "string" ? v : String(v);
  return Number.parseInt(hex, 16);
}

type ConnectWcOpts = {
  showQrModal?: boolean; // true for user-initiated QR, false for silent restore
};

export async function connectWalletConnect(opts?: ConnectWcOpts) {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("MISSING_WC_PROJECT_ID");

  const rpcUrl = import.meta.env.VITE_ETHERLINK_RPC_URL as string;
  if (!rpcUrl) throw new Error("MISSING_ENV_VITE_ETHERLINK_RPC_URL");

  const showQrModal = opts?.showQrModal ?? true;

  const wc = await EthereumProvider.init({
    projectId,

    // ✅ Compatibility: avoid "required namespace" rejections
    optionalChains: [ETHERLINK_MAINNET.chainId],

    // ✅ Methods we might call
    optionalMethods: [
      "eth_requestAccounts",
      "eth_accounts",
      "eth_chainId",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "eth_sendTransaction",
      "personal_sign",
      "eth_signTypedData",
      "eth_signTypedData_v4",
    ],

    rpcMap: {
      [ETHERLINK_MAINNET.chainId]: rpcUrl,
    },

    showQrModal,

    metadata: {
      name: "Ppopgi",
      description: "Ppopgi raffle booth on Etherlink",
      url: window.location.origin,
      icons: [],
    },
  });

  try {
    await wc.connect();
  } catch {
    if (!showQrModal) throw new Error("WC_NO_SESSION");
    throw new Error("WC_CONNECT_REJECTED");
  }

  // 1) Ensure accounts are available for ethers v6
  await ensureAccountsHydrated(wc);

  // 2) Small buffer: some mobile wallets dislike immediate switch after connect
  await new Promise((r) => setTimeout(r, 800));

  // 3) Best-effort switch/add (DO NOT fail sign-in if wallet refuses)
  const switched = await ensureEtherlinkBestEffort(wc);
  if (switched) {
    try {
      await waitForChain(wc, ETHERLINK_MAINNET.chainId, 20000);
    } catch {
      // do not fail sign-in
    }
  }

  const provider = new BrowserProvider(wc as any);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();

  // Read chainId directly from WC provider (more reliable immediately after switch)
  const chainId = await getChainId(wc);

  return { provider, signer, account, chainId, wcProvider: wc };
}