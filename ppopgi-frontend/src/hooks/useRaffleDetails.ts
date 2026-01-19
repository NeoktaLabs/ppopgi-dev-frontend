// src/hooks/useRaffleDetails.ts
import { useEffect, useMemo, useState } from "react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

export type RaffleStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED"
  | "UNKNOWN";

function statusFromUint8(n: number): RaffleStatus {
  // Keep this mapping aligned with your contract enum
  if (n === 0) return "FUNDING_PENDING";
  if (n === 1) return "OPEN";
  if (n === 2) return "DRAWING";
  if (n === 3) return "COMPLETED";
  if (n === 4) return "CANCELED";
  return "UNKNOWN";
}

export type RaffleDetails = {
  address: string;

  name: string;
  status: RaffleStatus;

  sold: string;

  ticketPrice: string; // uint256 (USDC 6 decimals) as string
  winningPot: string; // uint256 (USDC 6 decimals) as string

  minTickets: string; // uint64 as string
  maxTickets: string; // uint64 as string
  deadline: string; // uint64 unix seconds as string
  paused: boolean;

  usdcToken: string;
  creator: string;

  // settlement
  winner: string;
  winningTicketIndex: string;

  // fee transparency
  feeRecipient: string;
  protocolFeePercent: string;
};

export function useRaffleDetails(raffleAddress: string | null, open: boolean) {
  const [data, setData] = useState<RaffleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const contract = useMemo(() => {
    if (!raffleAddress) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: raffleAddress,
    });
  }, [raffleAddress]);

  useEffect(() => {
    if (!open || !contract || !raffleAddress) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setNote(null);

      try {
        const [
          name,
          statusU8,
          sold,
          ticketPrice,
          winningPot,
          minTickets,
          maxTickets,
          deadline,
          paused,
          usdcToken,
          creator,
          winner,
          winningTicketIndex,
          feeRecipient,
          protocolFeePercent,
        ] = await Promise.all([
          readContract({ contract, method: "function name() view returns (string)" }),
          readContract({ contract, method: "function status() view returns (uint8)" }),
          readContract({ contract, method: "function getSold() view returns (uint256)" }),
          readContract({ contract, method: "function ticketPrice() view returns (uint256)" }),
          readContract({ contract, method: "function winningPot() view returns (uint256)" }),
          readContract({ contract, method: "function minTickets() view returns (uint64)" }),
          readContract({ contract, method: "function maxTickets() view returns (uint64)" }),
          readContract({ contract, method: "function deadline() view returns (uint64)" }),
          readContract({ contract, method: "function paused() view returns (bool)" }),
          readContract({ contract, method: "function usdcToken() view returns (address)" }),
          readContract({ contract, method: "function creator() view returns (address)" }),
          readContract({ contract, method: "function winner() view returns (address)" }),
          readContract({ contract, method: "function winningTicketIndex() view returns (uint256)" }),
          readContract({ contract, method: "function feeRecipient() view returns (address)" }),
          readContract({ contract, method: "function protocolFeePercent() view returns (uint256)" }),
        ]);

        if (!alive) return;

        const statusNum = Number(statusU8);

        setData({
          address: raffleAddress,
          name: String(name),
          status: statusFromUint8(statusNum),

          sold: String(sold),

          ticketPrice: String(ticketPrice),
          winningPot: String(winningPot),

          minTickets: String(minTickets),
          maxTickets: String(maxTickets),
          deadline: String(deadline),
          paused: Boolean(paused),

          usdcToken: String(usdcToken),
          creator: String(creator),

          winner: String(winner),
          winningTicketIndex: String(winningTicketIndex),

          feeRecipient: String(feeRecipient),
          protocolFeePercent: String(protocolFeePercent),
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
  }, [open, contract, raffleAddress]);

  return { data, loading, note };
}