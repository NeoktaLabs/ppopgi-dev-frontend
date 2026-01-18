import detectEthereumProvider from "@metamask/detect-provider";
import { BrowserProvider } from "ethers";
import { MetaMaskSDK } from "@metamask/sdk";

type Eip1193Provider = {
  request: (args: { method: string; params?: any }) => Promise<any>;
  isMetaMask?: boolean;
};

export type MetaMaskConnectResult = {
  provider: BrowserProvider;
  signer: any;
  account: string;
  chainId: number;
  // keep these so we can disconnect cleanly
  mmEip1193: any | null;
  mmSdk: MetaMaskSDK | null;
};

/**
 * Connect using injected MetaMask provider (extension / in-app browser).
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

  return {
    provider,
    signer,
    account,
    chainId: Number(network.chainId),
    mmEip1193: mm,
    mmSdk: null,
  };
}

/**
 * MetaMask-only QR / deeplink flow (best for Safari).
 * On mobile browsers: deeplinks to MetaMask mobile.
 * On desktop: can show a QR to connect to MetaMask mobile.
 */
export async function connectMetaMaskSdk(): Promise<MetaMaskConnectResult> {
  // IMPORTANT: create ONE SDK instance per connect attempt (simple + predictable)
  const sdk = new MetaMaskSDK({
    dappMetadata: {
      name: "Ppopgi",
      url: window.location.origin,
    },
    // Show QR on desktop if extension isn't available
    // and deeplink on mobile browsers like Safari.
    enableDebug: false,
  });

  // The SDK exposes an EIP-1193 provider
  const mmProvider = sdk.getProvider();
  if (!mmProvider) throw new Error("METAMASK_SDK_NO_PROVIDER");

  // Triggers deeplink/QR connection flow
  await mmProvider.request({ method: "eth_requestAccounts" });

  const provider = new BrowserProvider(mmProvider as any);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    account,
    chainId: Number(network.chainId),
    mmEip1193: mmProvider,
    mmSdk: sdk,
  };
}