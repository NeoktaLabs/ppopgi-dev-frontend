// src/indexer/filterRaffles.ts
import type { RaffleListItem } from "./subgraph";

const V2_DEPLOYER = "0x5dbDC8536164DFE454331e4EdE469B6a3FCc2922".toLowerCase();

export function filterToV2Deployer(items: RaffleListItem[]): RaffleListItem[] {
  return items.filter((r) => (r.deployer ?? "").toLowerCase() === V2_DEPLOYER);
}