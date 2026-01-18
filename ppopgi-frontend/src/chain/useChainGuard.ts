// src/chain/useChainGuard.ts
import { useSession } from "../state/useSession";
import { ETHERLINK_MAINNET } from "./etherlink";

export function useChainGuard() {
  const chainId = useSession((s) => s.chainId);

  const isOnEtherlink = chainId === ETHERLINK_MAINNET.chainId;

  return {
    isOnEtherlink,
    expectedChain: ETHERLINK_MAINNET,
  };
}