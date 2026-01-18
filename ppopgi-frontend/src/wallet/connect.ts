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

export async function connectWalletConnect() {
  const projectId = import.meta.env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("MISSING_WC_PROJECT_ID");

  const wc = await EthereumProvider.init({
    projectId,
    optionalChains: [ETHERLINK_MAINNET.chainId],
    showQrModal: true,
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
    throw new Error("WC_CONNECT_REJECTED");
  }

  const provider = new BrowserProvider(wc as any);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const network = await provider.getNetwork();

  return { provider, signer, account, chainId: Number(network.chainId), wcProvider: wc };
}