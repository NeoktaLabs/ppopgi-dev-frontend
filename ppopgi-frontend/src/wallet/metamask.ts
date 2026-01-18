// src/wallet/metamask.ts
import detectEthereumProvider from "@metamask/detect-provider";
import { BrowserProvider } from "ethers";
import { MetaMaskSDK } from "@metamask/sdk";

type Eip1193Provider = {
  request: (args: { method: string; params?: any }) => Promise<any>;
};

export type MetaMaskConnectResult = {
  provider: BrowserProvider;
  signer: any;
  account: string;
  chainId: number;
  mmEip1193: any | null;
  mmSdk: MetaMaskSDK | null;
};

// --- SINGLETONS (important for Safari stability)
let sdkSingleton: MetaMaskSDK | null = null;
let eip1193Singleton: any | null = null;

function getSdk(): { sdk: MetaMaskSDK; mmProvider: any } {
  if (!sdkSingleton) {
    sdkSingleton = new MetaMaskSDK({
      dappMetadata: {
        name: "Ppopgi",
        url: window.location.origin,
      },
      enableDebug: false,
    });
  }

  const mmProvider = sdkSingleton.getProvider();
  if (!mmProvider) throw new Error("METAMASK_SDK_NO_PROVIDER");

  eip1193Singleton = mmProvider;
  return { sdk: sdkSingleton, mmProvider };
}

async function toEthers(mmProvider: any, sdk: MetaMaskSDK): Promise<MetaMaskConnectResult> {
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

/**
 * Connect using injected MetaMask provider (extension / MetaMask in-app browser).
 */
export async function connectMetaMaskInjected(): Promise<MetaMaskConnectResult> {
  const mm = (await detectEthereumProvider({
    mustBeMetaMask: true,
    silent: true,
  })) as Eip1193Provider | null;

  if (!mm) throw new Error("NO_METAMASK_INJECTED");

  await mm.request({ method: "eth_requestAccounts" });
  return toEthers(mm, null as any);
}

/**
 * MetaMask-only QR / deeplink flow (Safari-friendly).
 * Uses a singleton SDK instance for stability.
 */
export async function connectMetaMaskSdk(): Promise<MetaMaskConnectResult> {
  // 1) try normal connect
  try {
    const { sdk, mmProvider } = getSdk();

    // If already connected, reuse
    const existing = (await mmProvider.request({ method: "eth_accounts" })) as string[];
    if (existing?.[0]) {
      return toEthers(mmProvider, sdk);
    }

    await mmProvider.request({ method: "eth_requestAccounts" });
    return toEthers(mmProvider, sdk);
  } catch (err) {
    // 2) clean reconnect (very important for "worked once then fails")
    try {
      eip1193Singleton?.disconnect?.();
    } catch {}
    try {
      sdkSingleton?.disconnect?.();
    } catch {}

    sdkSingleton = null;
    eip1193Singleton = null;

    // retry once
    const { sdk, mmProvider } = getSdk();
    await mmProvider.request({ method: "eth_requestAccounts" });
    return toEthers(mmProvider, sdk);
  }
}