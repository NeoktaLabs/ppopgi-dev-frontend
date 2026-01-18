// src/hooks/useRaffleDetails.ts
import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider } from "ethers";
import LotterySingleWinnerAbi from "../config/abis/LotterySingleWinner.json";

export type RaffleStatus = "FUNDING_PENDING" | "OPEN" | "DRAWING" | "COMPLETED" | "CANCELED";

export type RaffleDetails = {
  id: string;

  name: string;
  status: RaffleStatus;
  paused: boolean;

  usdc: string;
  creator: string;
  deployer: string;

  winningPot: string;
  ticketPrice: string;
  minTickets: string;
  maxTickets: string;

  sold: string;
  ticketRevenue: string;

  deadline: string;

  feeRecipient: string;
  protocolFeePercent: string;

  // drawing fields
  selectedProvider: string;
  entropyRequestId: string;
  drawingRequestedAt: string;

  // result fields
  winner: string;
  winningTicketIndex: string;

  // cancel fields
  canceledAt: string;
  soldAtCancel: string;

  // proof-ish fields (shown in safety section)
  entropy: string;
  entropyProvider: string;
};

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

function statusFromUint8(x: number): RaffleStatus {
  if (x === 0) return "FUNDING_PENDING";
  if (x === 1) return "OPEN";
  if (x === 2) return "DRAWING";
  if (x === 3) return "COMPLETED";
  return "CANCELED";
}

export function useRaffleDetails(raffleId: string | null) {
  const [data, setData] = useState<RaffleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!raffleId) {
      setData(null);
      setLoading(false);
      setNote(null);
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      setNote(null);

      try {
        const rpcUrl = mustEnv("VITE_ETHERLINK_RPC_URL");
        const rpc = new JsonRpcProvider(rpcUrl);
        const c = new Contract(raffleId, LotterySingleWinnerAbi, rpc);

        const [
          name,
          statusU8,
          paused,

          usdc,
          creator,
          deployer,

          winningPot,
          ticketPrice,
          minTickets,
          maxTickets,

          sold,
          ticketRevenue,

          deadline,

          feeRecipient,
          protocolFeePercent,

          selectedProvider,
          entropyRequestId,
          drawingRequestedAt,

          winner,
          winningTicketIndex,

          canceledAt,
          soldAtCancel,

          entropy,
          entropyProvider,
        ] = await Promise.all([
          c.name(),
          c.status(),
          c.paused(),

          c.usdcToken(),
          c.creator(),
          c.deployer(),

          c.winningPot(),
          c.ticketPrice(),
          c.minTickets(),
          c.maxTickets(),

          c.getSold(),
          c.ticketRevenue(),

          c.deadline(),

          c.feeRecipient(),
          c.protocolFeePercent(),

          c.selectedProvider(),
          c.entropyRequestId(),
          c.drawingRequestedAt(),

          c.winner(),
          c.winningTicketIndex(),

          c.canceledAt(),
          c.soldAtCancel(),

          c.entropy(),
          c.entropyProvider(),
        ]);

        if (!alive) return;

        setData({
          id: raffleId,

          name: String(name),
          status: statusFromUint8(Number(statusU8)),
          paused: Boolean(paused),

          usdc: String(usdc),
          creator: String(creator),
          deployer: String(deployer),

          winningPot: winningPot.toString(),
          ticketPrice: ticketPrice.toString(),
          minTickets: minTickets.toString(),
          maxTickets: maxTickets.toString(),

          sold: sold.toString(),
          ticketRevenue: ticketRevenue.toString(),

          deadline: deadline.toString(),

          feeRecipient: String(feeRecipient),
          protocolFeePercent: protocolFeePercent.toString(),

          selectedProvider: String(selectedProvider),
          entropyRequestId: entropyRequestId.toString(),
          drawingRequestedAt: drawingRequestedAt.toString(),

          winner: String(winner),
          winningTicketIndex: winningTicketIndex.toString(),

          canceledAt: canceledAt.toString(),
          soldAtCancel: soldAtCancel.toString(),

          entropy: String(entropy),
          entropyProvider: String(entropyProvider),
        });
      } catch {
        if (!alive) return;
        setData(null);
        setNote("Could not load this raffle right now. Please try again.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [raffleId]);

  return { data, loading, note };
}