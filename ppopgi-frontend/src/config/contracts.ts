import LotteryRegistryAbi from "./abis/LotteryRegistry.json";
import SingleWinnerDeployerAbi from "./abis/SingleWinnerDeployer.json";
import LotterySingleWinnerAbi from "./abis/LotterySingleWinner.json";

export const ABIS = {
  LotteryRegistry: LotteryRegistryAbi,
  SingleWinnerDeployer: SingleWinnerDeployerAbi,
  LotterySingleWinner: LotterySingleWinnerAbi,
} as const;