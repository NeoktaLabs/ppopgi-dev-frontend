import LotteryRegistryAbi from "./abis/LotteryRegistry.json";
import SingleWinnerDeployerAbi from "./abis/SingleWinnerDeployerV2.json";
import LotterySingleWinnerAbi from "./abis/LotterySingleWinnerV2.json";

export const ADDRESSES = {
  LotteryRegistry: "0x1CD24E0C49b1B61ff07be12fBa3ce58eCb20b098",
  SingleWinnerDeployer: "0x5dbDC8536164DFE454331e4EdE469B6a3FCc2922",
  USDC: "0x796Ea11Fa2dD751eD01b53C372fFDB4AAa8f00F9",
} as const;

export const ABIS = {
  LotteryRegistry: LotteryRegistryAbi,
  SingleWinnerDeployer: SingleWinnerDeployerAbi,
  LotterySingleWinner: LotterySingleWinnerAbi,
} as const;