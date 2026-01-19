// src/hooks/useRaffleDetails.ts
import { useEffect, useMemo, useState } from "react";
import { getContract, readContract } from "thirdweb";
import { thirdwebClient } from "../thirdweb/client";
import { ETHERLINK_CHAIN } from "../thirdweb/etherlink";
import { getAddress } from "ethers";

export type RaffleStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED"
  | "UNKNOWN";

function statusFromUint8(n: number): RaffleStatus {
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

  ticketPrice: string; // uint256 raw (USDC 6 decimals)
  winningPot: string; // uint256 raw (USDC 6 decimals)

  minTickets: string; // uint64 raw
  maxTickets: string; // uint64 raw
  deadline: string; // uint64 unix seconds
  paused: boolean;

  usdcToken: string;
  creator: string;

  winner: string;
  winningTicketIndex: string;

  feeRecipient: string;
  protocolFeePercent: string;

  // ✅ for SafetyProofModal (present in your ABI)
  ticketRevenue: string; // uint256
  entropyProvider: string; // address
  entropyRequestId: string; // uint64
  selectedProvider: string; // address
};

async function readFirst(contract: any, label: string, candidates: string[]): Promise<any> {
  let lastErr: any = null;
  for (const method of candidates) {
    try {
      return await readContract({ contract, method });
    } catch (e) {
      lastErr = e;
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[useRaffleDetails] Failed to read ${label}. Tried:`, candidates, lastErr);
  throw lastErr;
}

async function readFirstOr(contract: any, label: string, candidates: string[], fallback: any): Promise<any> {
  try {
    return await readFirst(contract, label, candidates);
  } catch {
    return fallback;
  }
}

export function useRaffleDetails(raffleAddress: string | null, open: boolean) {
  const [data, setData] = useState<RaffleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const normalizedAddress = useMemo(() => {
    if (!raffleAddress) return null;
    try {
      return getAddress(raffleAddress);
    } catch {
      return raffleAddress;
    }
  }, [raffleAddress]);

  const contract = useMemo(() => {
    if (!normalizedAddress) return null;
    return getContract({
      client: thirdwebClient,
      chain: ETHERLINK_CHAIN,
      address: normalizedAddress,
    });
  }, [normalizedAddress]);

  useEffect(() => {
    if (!open || !contract || !normalizedAddress) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setNote(null);

      try {
        // ✅ ABI-backed reads
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
          ticketRevenue,
          entropyProvider,
          entropyRequestId,
          selectedProvider,
        ] = await Promise.all([
          readFirstOr(contract, "name", ["function name() view returns (string)"], "Unknown raffle"),
          readFirstOr(contract, "status", ["function status() view returns (uint8)"], 255),
          readFirstOr(contract, "sold", ["function getSold() view returns (uint256)"], 0n),
          readFirstOr(contract, "ticketPrice", ["function ticketPrice() view returns (uint256)"], 0n),
          readFirstOr(contract, "winningPot", ["function winningPot() view returns (uint256)"], 0n),
          readFirstOr(contract, "minTickets", ["function minTickets() view returns (uint64)"], 0),
          readFirstOr(contract, "maxTickets", ["function maxTickets() view returns (uint64)"], 0),
          readFirstOr(contract, "deadline", ["function deadline() view returns (uint64)"], 0),
          readFirstOr(contract, "paused", ["function paused() view returns (bool)"], false),
          readFirstOr(contract, "usdcToken", ["function usdcToken() view returns (address)"], "0x0000000000000000000000000000000000000000"),
          readFirstOr(contract, "creator", ["function creator() view returns (address)"], "0x0000000000000000000000000000000000000000"),
          readFirstOr(contract, "winner", ["function winner() view returns (address)"], "0x0000000000000000000000000000000000000000"),
          readFirstOr(contract, "winningTicketIndex", ["function winningTicketIndex() view returns (uint256)"], 0n),
          readFirstOr(contract, "feeRecipient", ["function feeRecipient() view returns (address)"], "0x0000000000000000000000000000000000000000"),
          readFirstOr(contract, "protocolFeePercent", ["function protocolFeePercent() view returns (uint256)"], 0n),

          // ✅ SafetyProofModal fields (present in your ABI)
          readFirstOr(contract, "ticketRevenue", ["function ticketRevenue() view returns (uint256)"], 0n),
          readFirstOr(contract, "entropyProvider", ["function entropyProvider() view returns (address)"], "0x0000000000000000000000000000000000000000"),
          readFirstOr(contract, "entropyRequestId", ["function entropyRequestId() view returns (uint64)"], 0),
          readFirstOr(contract, "selectedProvider", ["function selectedProvider() view returns (address)"], "0x0000000000000000000000000000000000000000"),
        ]);

        if (!alive) return;

        setData({
          address: normalizedAddress,
          name: String(name),
          status: statusFromUint8(Number(statusU8)),

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

          ticketRevenue: String(ticketRevenue),
          entropyProvider: String(entropyProvider),
          entropyRequestId: String(entropyRequestId),
          selectedProvider: String(selectedProvider),
        });

        if (String(name) === "Unknown raffle") {
          setNote("Some live fields could not be read yet, but the raffle is reachable.");
        }
      } catch {
        if (!alive) return;
        setData(null);
        setNote("Could not load this raffle right now. Please refresh (and check console logs).");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, contract, normalizedAddress]);

  return { data, loading, note };
}