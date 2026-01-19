// src/chain/useChainGuard.ts
import { useMemo } from "react";
import { useActiveWalletChain, useSwitchChain } from "thirdweb/react";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { ETHERLINK_MAINNET } from "./etherlink";

export function useChainGuard() {
  // thirdweb is the source of truth for the connected chain
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchChain();

  const isOnEtherlink = useMemo(() => {
    // If no wallet is connected yet, we treat it as "not on Etherlink"
    if (!activeChain?.id) return false;
    return activeChain.id === ETHERLINK_CHAIN.id;
  }, [activeChain?.id]);

  async function switchToEtherlink() {
    // This will prompt the connected wallet to switch networks
    await switchChain(ETHERLINK_CHAIN);
  }

  return {
    isOnEtherlink,
    expectedChain: ETHERLINK_MAINNET, // keep your existing UI-friendly object
    activeChainId: activeChain?.id ?? null,
    switchToEtherlink,
  };
}