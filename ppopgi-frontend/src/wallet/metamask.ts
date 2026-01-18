// src/wallet/metamask.ts
import detectEthereumProvider from "@metamask/detect-provider";
import { BrowserProvider } from "ethers";

type Eip1193Provider = {
  request: (args: { method: string; params?: any }) => Promise<any>;
};

export type MetaMaskConnectResult = {
  provider: BrowserProvider;
  signer: any;
  account: string;
  chainId: number;
};

/**
 * Connect using injected MetaMask provider (extension / MetaMask in-app browser).
 * If MetaMask isn't present, throws NO_METAMASK_INJECTED.
 */
export async function connectMetaMaskInjected(): Promise<MetaMaskConnectResult> {
  const mm = (await detectEthereumProvider({
    mustBeMetaMask: true,
    silent: true,
  })) as Eip1193Provider | null;

  if (!mm) throw new Error("NO_METAMASK_INJECTED");

  await mm.request({ method: "eth_requestAccounts" });

  const provider = new BrowserProvider(mm as any);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const network = await provider.getNetwork();

  return { provider, signer, account, chainId: Number(network.chainId) };
}