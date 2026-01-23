// src/indexer/filterRaffles.ts
import type { RaffleListItem } from "./subgraph";

const V2_DEPLOYER = "0x6050196520e7010Aa39C8671055B674851E2426D".toLowerCase();

export function filterToV2Deployer(items: RaffleListItem[]): RaffleListItem[] {
  return items.filter((r) => (r.deployer ?? "").toLowerCase() === V2_DEPLOYER);
}