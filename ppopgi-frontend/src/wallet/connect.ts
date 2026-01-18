// src/wallet/connect.ts
import { BrowserProvider } from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";
import { ETHERLINK_MAINNET } from "../chain/etherlink";

type Eip1193Provider = {
  request: (args: { method: string; params?: any }) => Promise<any>;
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

async function ensureEtherlink(eip1193: any) {
  const targetHex = hexChainId(ETHERLINK_MAINNET.chainId);
  const rpcUrl = import.meta.env.VITE_ETHERLINK_RPC_URL as string;
  if (!rpcUrl) throw new Error("MISSING_ENV_VITE_ETHERLINK_RPC_URL");

  try {
    await eip1193.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
  } catch (e: any) {
    // 4902 = chain not added
    if (e?.code === 4902 || String(e?.message || "").includes("4902")) {
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
    } else {
      throw e;
    }
  }
}

function waitForChain(eip1193: any, targetChainId: number, ms = 6000) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      try {
        eip1193.removeListener?.("chainChanged", onChain);
      } catch {}
      clearTimeout(t);
    };

    const onChain = (hexId: string) => {
      const id = Number.parseInt(hexId, 16);
      if (id === targetChainId) {
        cleanup();
        resolve();
      }
    };

    const t = setTimeout(() => {
      cleanup();
      reject(new Error("CHAIN_SWITCH_TIMEOUT"));
    }, ms);

    // If already correct, resolve immediately; otherwise listen
    eip1193
      .request({ method: "eth_chainId" })
      .then((hexId: string) => {
        const id = Number.parseInt(hexId, 16);
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

type ConnectWcOpts = {
  showQrModal?: boolean; // true for user-initiated QR, false for silent restore
  recommendedWalletIds?: string[];
};

export async function connectWalletConnect(opts?: ConnectWcOpts) {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("MISSING_WC_PROJECT_ID");

  const rpcUrl = import.meta.env.VITE_ETHERLINK_RPC_URL as string;
  if (!rpcUrl) throw new Error("MISSING_ENV_VITE_ETHERLINK_RPC_URL");

  const showQrModal = opts?.showQrModal ?? true;

  const wc = await EthereumProvider.init({
  projectId,

  // ✅ IMPORTANT: use optionalChains (recommended)
  // Do NOT use `chains:` here (it makes Etherlink required and some wallets reject)
  optionalChains: [ETHERLINK_MAINNET.chainId],

  // ✅ Include methods we will call (switch/add)
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

  ...(opts?.recommendedWalletIds
    ? { qrModalOptions: { recommendedWalletIds: opts.recommendedWalletIds } }
    : {}),

  metadata: {
    name: "Ppopgi",
    description: "Ppopgi raffle booth on Etherlink",
    url: window.location.origin,
    icons: [],
  },
});

  // ✅ IMPORTANT:
  // - If showQrModal=true, this opens the QR modal if needed.
  // - If showQrModal=false, this will only succeed if there is an existing session.
  try {
    await wc.connect();
  } catch (e) {
    if (!showQrModal) throw new Error("WC_NO_SESSION");
    throw new Error("WC_CONNECT_REJECTED");
  }

  // ✅ Enforce Etherlink after connect (fixes “wrong chain” on QR)
  await ensureEtherlink(wc);
  await waitForChain(wc, ETHERLINK_MAINNET.chainId);

  const provider = new BrowserProvider(wc as any);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const network = await provider.getNetwork();

  return { provider, signer, account, chainId: Number(network.chainId), wcProvider: wc };
}