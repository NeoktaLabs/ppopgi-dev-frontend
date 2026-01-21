// src/indexer/subgraph.ts

export type RaffleStatus =
  | "FUNDING_PENDING"
  | "OPEN"
  | "DRAWING"
  | "COMPLETED"
  | "CANCELED";

export type RaffleListItem = {
  id: string; // raffle address
  name: string;
  status: RaffleStatus;

  creator: string;

  winningPot: string; // BigInt as string
  ticketPrice: string; // BigInt as string
  deadline: string; // BigInt as string (seconds)

  sold: string; // BigInt as string
  minTickets?: string; // BigInt as string
  maxTickets: string; // BigInt as string

  protocolFeePercent: string; // BigInt as string
  feeRecipient: string;

  paused?: boolean;

  // outcome / lifecycle
  winner?: string | null;
  winningTicketIndex?: string | null;
  completedAt?: string | null;

  canceledReason?: string | null;
  canceledAt?: string | null;

  deployer?: string | null;
  lastUpdatedTimestamp?: string | null;
};

function mustEnv(name: string): string {
  const v = (import.meta as any).env?.[name];
  if (!v) throw new Error(`MISSING_ENV_${name}`);
  return v;
}

export async function fetchRafflesFromSubgraph(
  signal?: AbortSignal
): Promise<RaffleListItem[]> {
  const url = mustEnv("VITE_SUBGRAPH_URL");

  const query = `
    query HomeRaffles($first: Int!) {
      raffles(
        first: $first
        orderBy: lastUpdatedTimestamp
        orderDirection: desc
      ) {
        id
        name
        status
        creator

        winningPot
        ticketPrice
        deadline

        sold
        minTickets
        maxTickets

        protocolFeePercent
        feeRecipient

        paused

        winner
        winningTicketIndex
        completedAt

        canceledReason
        canceledAt

        deployer
        lastUpdatedTimestamp
      }
    }
  `;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { first: 500 } }),
    signal,
  });

  if (!res.ok) throw new Error("SUBGRAPH_HTTP_ERROR");

  const json = await res.json();
  if (json?.errors?.length) throw new Error("SUBGRAPH_GQL_ERROR");

  return (json.data?.raffles ?? []) as RaffleListItem[];
}