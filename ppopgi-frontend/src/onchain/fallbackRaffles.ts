// src/onchain/fallbackRaffles.ts
import { Contract, JsonRpcProvider } from "ethers";
import { ADDRESSES } from "../config/contracts";
import LotteryRegistryAbi from "../config/abis/LotteryRegistry.json";
import LotterySingleWinnerAbi from "../config/abis/LotterySingleWinner.json";
import type { RaffleListItem, RaffleStatus } from "../indexer/subgraph";

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function statusFromUint8(x: number): RaffleStatus {
  // Match your enum order in schema:
  // FUNDING_PENDING, OPEN, DRAWING, COMPLETED, CANCELED
  if (x === 0) return "FUNDING_PENDING";
  if (x === 1) return "OPEN";
  if (x === 2) return "DRAWING";
  if (x === 3) return "COMPLETED";
  return "CANCELED";
}

export async function fetchRafflesOnChainFallback(limit = 120): Promise<RaffleListItem[]> {
  const rpcUrl = mustEnv("VITE_ETHERLINK_RPC_URL");

  const rpc = new JsonRpcProvider(rpcUrl);
  const reg = new Contract(ADDRESSES.LotteryRegistry, LotteryRegistryAbi, rpc);

  const countBn = await reg.getAllLotteriesCount();
  const count = Number(countBn);

  const pageSize = 25;
  const maxToLoad = Math.min(limit, count);

  // Load newest first (end of list)
  const start = Math.max(0, count - maxToLoad);
  const addrs: string[] = [];

  for (let i = start; i < count; i += pageSize) {
    const page = await reg.getAllLotteries(i, Math.min(pageSize, count - i));
    for (const a of page as string[]) addrs.push(a);
  }

  const out: RaffleListItem[] = [];

  for (const addr of addrs) {
    const raffle = new Contract(addr, LotterySingleWinnerAbi, rpc);

    const [
      name,
      statusU8,
      winningPot,
      ticketPrice,
      deadline,
      sold,
      maxTickets,
      protocolFeePercent,
      feeRecipient,
      deployer,
      creator, // ✅ add creator
    ] = await Promise.all([
      raffle.name(),
      raffle.status(),
      raffle.winningPot(),
      raffle.ticketPrice(),
      raffle.deadline(),
      raffle.getSold(),
      raffle.maxTickets(),
      raffle.protocolFeePercent(),
      raffle.feeRecipient(),
      raffle.deployer(),
      raffle.creator(), // ✅ exists in your ABI
    ]);

    // ✅ fallback "last updated": now (seconds)
    const nowSec = String(Math.floor(Date.now() / 1000));

    out.push({
      id: addr,
      name: String(name),
      status: statusFromUint8(Number(statusU8)),
      winningPot: winningPot.toString(),
      ticketPrice: ticketPrice.toString(),
      deadline: deadline.toString(),
      sold: sold.toString(),
      maxTickets: maxTickets.toString(),
      protocolFeePercent: protocolFeePercent.toString(),
      feeRecipient: String(feeRecipient),
      deployer: String(deployer),
      creator: String(creator),
      lastUpdatedTimestamp: nowSec,
    });
  }

  return out;
}