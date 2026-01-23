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

const ZERO = "0x0000000000000000000000000000000000000000";

export type RaffleDetails = {
  address: string;

  name: string;
  status: RaffleStatus;

  sold: string;
  ticketRevenue: string;

  ticketPrice: string; // uint256 raw (USDC 6 decimals)
  winningPot: string; // uint256 raw (USDC 6 decimals)

  minTickets: string; // uint64 raw
  maxTickets: string; // uint64 raw
  deadline: string; // uint64 unix seconds
  paused: boolean;

  // ✅ V2: enforce minimum purchase in UI
  minPurchaseAmount: string; // uint32 raw

  // ✅ V2: optional but useful for DRAWING diagnostics
  finalizeRequestId: string; // uint64 raw (0 if none / unknown)
  callbackGasLimit: string; // uint32 raw

  // token + parties
  usdcToken: string;
  creator: string;

  winner: string;
  winningTicketIndex: string;

  feeRecipient: string;
  protocolFeePercent: string;

  // entropy
  entropy: string;
  entropyProvider: string;
  entropyRequestId: string;
  selectedProvider: string;
};

async function readFirst(
  contract: any,
  label: string,
  candidates: string[],
  params: readonly unknown[] = []
): Promise<any> {
  let lastErr: any = null;
  for (const method of candidates) {
    try {
      return await readContract({ contract, method, params });
    } catch (e) {
      lastErr = e;
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[useRaffleDetails] Failed to read ${label}. Tried:`, candidates, lastErr);
  throw lastErr;
}

async function readFirstOr(
  contract: any,
  label: string,
  candidates: string[],
  fallback: any,
  params: readonly unknown[] = []
): Promise<any> {
  try {
    return await readFirst(contract, label, candidates, params);
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
        const name = await readFirstOr(
          contract,
          "name",
          ["function name() view returns (string)"],
          "Unknown raffle"
        );

        const statusU8 = await readFirstOr(
          contract,
          "status",
          ["function status() view returns (uint8)"],
          255
        );

        const sold = await readFirstOr(
          contract,
          "sold",
          ["function getSold() view returns (uint256)"],
          0n
        );

        const ticketPrice = await readFirstOr(
          contract,
          "ticketPrice",
          ["function ticketPrice() view returns (uint256)"],
          0n
        );

        const winningPot = await readFirstOr(
          contract,
          "winningPot",
          ["function winningPot() view returns (uint256)"],
          0n
        );

        const minTickets = await readFirstOr(
          contract,
          "minTickets",
          ["function minTickets() view returns (uint64)"],
          0
        );

        const maxTickets = await readFirstOr(
          contract,
          "maxTickets",
          ["function maxTickets() view returns (uint64)"],
          0
        );

        const deadline = await readFirstOr(
          contract,
          "deadline",
          ["function deadline() view returns (uint64)"],
          0
        );

        const paused = await readFirstOr(
          contract,
          "paused",
          ["function paused() view returns (bool)"],
          false
        );

        const usdcToken = await readFirstOr(
          contract,
          "usdcToken",
          ["function usdcToken() view returns (address)"],
          ZERO
        );

        const creator = await readFirstOr(
          contract,
          "creator",
          ["function creator() view returns (address)"],
          ZERO
        );

        const winner = await readFirstOr(
          contract,
          "winner",
          ["function winner() view returns (address)"],
          ZERO
        );

        const winningTicketIndex = await readFirstOr(
          contract,
          "winningTicketIndex",
          ["function winningTicketIndex() view returns (uint256)"],
          0n
        );

        const feeRecipient = await readFirstOr(
          contract,
          "feeRecipient",
          ["function feeRecipient() view returns (address)"],
          ZERO
        );

        const protocolFeePercent = await readFirstOr(
          contract,
          "protocolFeePercent",
          ["function protocolFeePercent() view returns (uint256)"],
          0n
        );

        const ticketRevenue = await readFirstOr(
          contract,
          "ticketRevenue",
          ["function ticketRevenue() view returns (uint256)"],
          0n
        );

        // ✅ V2 additions
        const minPurchaseAmount = await readFirstOr(
          contract,
          "minPurchaseAmount",
          ["function minPurchaseAmount() view returns (uint32)"],
          1
        );

        const finalizeRequestId = await readFirstOr(
          contract,
          "finalizeRequestId",
          [
            // try common spellings; keep resilient
            "function finalizeRequestId() view returns (uint64)",
            "function entropyRequestId() view returns (uint64)", // fallback if contract reuses the same id
          ],
          0
        );

        const callbackGasLimit = await readFirstOr(
          contract,
          "callbackGasLimit",
          ["function callbackGasLimit() view returns (uint32)"],
          0
        );

        const entropy = await readFirstOr(
          contract,
          "entropy",
          ["function entropy() view returns (address)"],
          ZERO
        );

        const entropyProvider = await readFirstOr(
          contract,
          "entropyProvider",
          ["function entropyProvider() view returns (address)"],
          ZERO
        );

        const entropyRequestId = await readFirstOr(
          contract,
          "entropyRequestId",
          ["function entropyRequestId() view returns (uint64)"],
          0
        );

        const selectedProvider = await readFirstOr(
          contract,
          "selectedProvider",
          ["function selectedProvider() view returns (address)"],
          ZERO
        );

        if (!alive) return;

        setData({
          address: normalizedAddress,
          name: String(name),
          status: statusFromUint8(Number(statusU8)),

          sold: String(sold),
          ticketRevenue: String(ticketRevenue),

          ticketPrice: String(ticketPrice),
          winningPot: String(winningPot),

          minTickets: String(minTickets),
          maxTickets: String(maxTickets),
          deadline: String(deadline),
          paused: Boolean(paused),

          minPurchaseAmount: String(minPurchaseAmount),
          finalizeRequestId: String(finalizeRequestId),
          callbackGasLimit: String(callbackGasLimit),

          usdcToken: String(usdcToken),
          creator: String(creator),

          winner: String(winner),
          winningTicketIndex: String(winningTicketIndex),

          feeRecipient: String(feeRecipient),
          protocolFeePercent: String(protocolFeePercent),

          entropy: String(entropy),
          entropyProvider: String(entropyProvider),
          entropyRequestId: String(entropyRequestId),
          selectedProvider: String(selectedProvider),
        });

        if (String(name) === "Unknown raffle") {
          setNote("Some live fields could not be read yet, but the raffle is reachable.");
        }
      } catch (e: any) {
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