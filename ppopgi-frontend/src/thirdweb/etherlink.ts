import { defineChain } from "thirdweb/chains";
import { ETHERLINK_MAINNET } from "../chain/etherlink";

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

export const ETHERLINK_CHAIN = defineChain({
  id: ETHERLINK_MAINNET.chainId,
  name: ETHERLINK_MAINNET.chainName,
  nativeCurrency: { name: "XTZ", symbol: "XTZ", decimals: 18 },
  rpc: mustEnv("VITE_ETHERLINK_RPC_URL"),
  blockExplorers: [
    {
      name: "Etherlink Explorer",
      url: "https://explorer.etherlink.com",
    },
  ],
});