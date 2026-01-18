import { BrowserProvider } from "ethers";
import { ETHERLINK_MAINNET } from "../chain/etherlink";

type Eip1193Provider = {
  request: (args: { method: string; params?: any }) => Promise<any>;
};

function injected(): Eip1193Provider | null {
  return (window as any).ethereum ?? null;
}

export async function ensureEtherlink() {
  const eth = injected();
  if (!eth) throw new Error("NO_WALLET");

  const current = (await eth.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === ETHERLINK_MAINNET.chainIdHex.toLowerCase()) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ETHERLINK_MAINNET.chainIdHex }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ETHERLINK_MAINNET.chainIdHex,
            chainName: ETHERLINK_MAINNET.chainName,
            nativeCurrency: ETHERLINK_MAINNET.nativeCurrency,
            rpcUrls: [...ETHERLINK_MAINNET.rpcUrls],
            blockExplorerUrls: [...ETHERLINK_MAINNET.blockExplorerUrls],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function signIn() {
  const eth = injected();
  if (!eth) throw new Error("NO_WALLET");

  await eth.request({ method: "eth_requestAccounts" });

  const provider = new BrowserProvider(eth as any);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    account,
    chainId: Number(network.chainId),
  };
}