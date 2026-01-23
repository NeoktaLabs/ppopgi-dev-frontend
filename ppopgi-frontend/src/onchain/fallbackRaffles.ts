// src/onchain/fallbackRaffles.ts
import { Contract, JsonRpcProvider } from "ethers";
import { ADDRESSES } from "../config/contracts";
import LotteryRegistryAbi from "../config/abis/LotteryRegistry.json";
import LotterySingleWinnerAbi from "../config/abis/LotterySingleWinnerV2.json";
import type { RaffleListItem, RaffleStatus } from "../indexer/subgraph";

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function statusFromUint8(x: number): RaffleStatus {
  // FUNDING_PENDING, OPEN, DRAWING, COMPLETED, CANCELED
  if (x === 0) return "FUNDING_PENDING";
  if (x === 1) return "OPEN";
  if (x === 2) return "DRAWING";
  if (x === 3) return "COMPLETED";
  return "CANCELED";
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const ZERO_TX = "0x" + "0".repeat(64);

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
      // core
      name,
      statusU8,

      // economics
      winningPot,
      ticketPrice,
      deadline,
      minTickets,
      maxTickets,
      sold,
      ticketRevenue,

      // config
      usdcToken,
      entropy,
      entropyProvider,
      callbackGasLimit,
      minPurchaseAmount,
      protocolFeePercent,
      feeRecipient,

      // creation-ish
      deployer,
      creator,
      createdAt,

      // lifecycle-ish
      paused,
      entropyRequestId,
      selectedProvider,
      finalizedAt,
      winner,
      winningTicketIndex,
      canceledAt,
      soldAtCancel,
    ] = await Promise.all([
      raffle.name(),
      raffle.status(),

      raffle.winningPot(),
      raffle.ticketPrice(),
      raffle.deadline(),
      raffle.minTickets(),
      raffle.maxTickets(),
      raffle.getSold(),
      raffle.ticketRevenue(),

      raffle.usdcToken(),
      raffle.entropy(),
      raffle.entropyProvider(),
      raffle.callbackGasLimit(),
      raffle.minPurchaseAmount(),
      raffle.protocolFeePercent(),
      raffle.feeRecipient(),

      raffle.deployer(),
      raffle.creator(),
      raffle.createdAt(),

      raffle.paused(),
      raffle.entropyRequestId(),
      raffle.selectedProvider(),
      raffle.finalizedAt(),
      raffle.winner(),
      raffle.winningTicketIndex(),
      raffle.canceledAt(),
      raffle.soldAtCancel(),
    ]);

    // "last updated" best-effort:
    // use max of timestamps we can read, otherwise now
    const nowSec = Math.floor(Date.now() / 1000);
    const createdAtSec = Number(createdAt ?? 0);
    const deadlineSec = Number(deadline ?? 0);
    const finalizedAtSec = Number(finalizedAt ?? 0);
    const canceledAtSec = Number(canceledAt ?? 0);

    const lastUpdated = Math.max(nowSec, createdAtSec, deadlineSec, finalizedAtSec, canceledAtSec);
    const lastUpdatedTimestamp = String(lastUpdated);

    const status = statusFromUint8(Number(statusU8));
    const completedAt =
      status === "COMPLETED" ? (String(finalizedAtSec || lastUpdated) as string) : null;

    // We don't have the cancel reason without decoding events — leave null.
    const canceledReason = null;

    out.push({
      id: addr,
      name: String(name),
      status,

      // canonical discovery (unknown without registry/indexer)
      deployer: deployer ? String(deployer) : null,
      registry: null,
      typeId: null,
      registryIndex: null,
      isRegistered: false,
      registeredAt: null,

      // creation metadata (some we can, some we can't)
      creator: String(creator ?? ZERO_ADDR),
      createdAtBlock: "0", // not available without logs
      createdAtTimestamp: String(createdAtSec || nowSec),
      creationTx: ZERO_TX, // not available without logs

      // config / contracts
      usdc: String(usdcToken ?? ADDRESSES.USDC),
      entropy: String(entropy ?? ZERO_ADDR),
      entropyProvider: String(entropyProvider ?? ZERO_ADDR),
      feeRecipient: String(feeRecipient ?? ZERO_ADDR),
      protocolFeePercent: protocolFeePercent.toString(),
      callbackGasLimit: callbackGasLimit.toString(),
      minPurchaseAmount: minPurchaseAmount.toString(),

      // economics
      winningPot: winningPot.toString(),
      ticketPrice: ticketPrice.toString(),
      deadline: deadline.toString(),
      minTickets: minTickets.toString(),
      maxTickets: maxTickets.toString(),

      // lifecycle / state
      sold: sold.toString(),
      ticketRevenue: ticketRevenue.toString(),
      paused: Boolean(paused),

      finalizeRequestId: entropyRequestId ? entropyRequestId.toString() : null,
      finalizedAt: finalizedAtSec > 0 ? String(finalizedAtSec) : null,
      selectedProvider:
        selectedProvider && String(selectedProvider) !== ZERO_ADDR ? String(selectedProvider) : null,

      winner: winner && String(winner) !== ZERO_ADDR ? String(winner) : null,
      winningTicketIndex: winningTicketIndex ? winningTicketIndex.toString() : null,
      completedAt,

      canceledReason,
      canceledAt: canceledAtSec > 0 ? String(canceledAtSec) : null,
      soldAtCancel: soldAtCancel ? soldAtCancel.toString() : null,

      // indexing metadata (fallback)
      lastUpdatedBlock: "0",
      lastUpdatedTimestamp,
    });
  }

  return out;
}