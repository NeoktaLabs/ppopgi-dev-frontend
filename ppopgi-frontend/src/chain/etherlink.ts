export const ETHERLINK_MAINNET = {
  chainId: 42793,
  chainIdHex: "0xA729",
  chainName: "Etherlink Mainnet",
  nativeCurrency: { name: "XTZ", symbol: "XTZ", decimals: 18 },
  rpcUrls: ["https://node.mainnet.etherlink.com"],
  blockExplorerUrls: ["https://explorer.etherlink.com"],
} as const;

// src/chain/etherlink.ts
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

export const ETHERLINK_MAINNET = {
  chainId: ETHERLINK_CHAIN.id,
  chainName: ETHERLINK_CHAIN.name,
  nativeCurrency: ETHERLINK_CHAIN.nativeCurrency,
  rpcUrls: [ETHERLINK_CHAIN.rpc],
  blockExplorerUrls: ETHERLINK_CHAIN.blockExplorers?.map((b) => b.url) ?? [],
} as const;