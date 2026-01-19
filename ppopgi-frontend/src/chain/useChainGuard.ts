// src/chain/useChainGuard.ts
import { useActiveWalletChain, useSwitchActiveWalletChain } from "thirdweb/react";
import { ETHERLINK_MAINNET } from "./etherlink";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

export function useChainGuard() {
  // authoritative chain from thirdweb
  const chain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();

  const activeChainId = chain?.id ?? null;
  const isOnEtherlink = activeChainId === ETHERLINK_MAINNET.chainId;

  async function switchToEtherlink() {
    // This opens the wallet UI and asks user to switch
    await switchChain(ETHERLINK_CHAIN);
  }

  return {
    isOnEtherlink,
    activeChainId,
    expectedChain: ETHERLINK_MAINNET,
    switchToEtherlink,
  };
}