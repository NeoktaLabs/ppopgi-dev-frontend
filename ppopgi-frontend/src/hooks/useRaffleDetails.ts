// src/hooks/useRaffleDetails.ts
import { useEffect, useMemo, useState } from "react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";

export type RaffleDetails = {
  address: string;

  name: string;
  status: number; // enum Status as uint8
  sold: string;

  ticketPrice: string; // uint256 as string (USDC 6 decimals)
  winningPot: string; // uint256 as string (USDC 6 decimals)

  minTickets: string;
  maxTickets: string;
  deadline: string; // unix seconds
  paused: boolean;

  usdcToken: string;
  creator: string;
  winner: string;
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
          status,
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
        ]);

        if (!alive) return;

        setData({
          address: raffleAddress,
          name: String(name),
          status: Number(status),
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