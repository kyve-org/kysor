import { KYVE_NETWORK } from "@kyve/sdk/dist/utils/constants";

export interface IConfig {
  hostTarget: "macos" | "linux";
  autoDownload: boolean;
  protocolNode: {
    poolId: number;
    network: KYVE_NETWORK;
    initialStake: number;
    space: number;
    verbose: boolean;
  };
}

export default {
  // target of the host machine, can be either "macos" or "linux"
  // important for downloading the correct binaries
  hostTarget: "macos",

  // whether Kaiser should auto download new binaries
  // if set to false, you have to insert the binaries manually
  autoDownload: false,

  // settings for protocol node
  // notice that mnemonic and keyfile is missing, those need to be files under the secrets directory
  protocolNode: {
    poolId: 0,
    network: "alpha",
    initialStake: 100,
    space: 1000000000,
    verbose: true,
  },
} as IConfig;
