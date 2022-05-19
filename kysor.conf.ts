import { IConfig } from "./src/faces";

const config: IConfig = {
  // target of the host machine, can be either "macos" or "linux"
  // important for downloading the correct binaries
  hostTarget: "macos",

  // whether KYSOR should auto download new binaries
  // if set to false, you have to insert the binaries manually
  autoDownload: true,

  // whether KYSOR should verify the checksums of downloaded binaries
  // if autoDownload is false this option can be ignored
  verifyChecksums: true,

  // settings for protocol node
  // notice that mnemonic and keyfile is missing, those need to be files under the secrets directory
  protocolNode: {
    poolId: 0,
    network: "alpha",
    initialStake: 100,
    space: 1000000000,
    verbose: true,
  },
};

export default config;
