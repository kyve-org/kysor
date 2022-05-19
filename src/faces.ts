import { KYVE_NETWORK } from "@kyve/sdk/dist/utils/constants";

export interface IConfig {
  hostTarget: "linux" | "macos";
  autoDownload: boolean;
  verifyChecksums: boolean;
  protocolNode: {
    poolId: number;
    network: KYVE_NETWORK;
    initialStake: number;
    space: number;
    verbose: boolean;
  };
}
