import { IConfig } from "./src/faces";

const config: IConfig = {
  // target of the host machine, can be either "linux-x64", "linux-arm64" or "macos-x64"
  // important for downloading the correct binaries
  hostTarget: "linux-x64",

  // whether KYSOR should auto download new binaries
  // if set to false, you have to insert the binaries manually
  autoDownload: true,

  // whether KYSOR should verify the checksums of downloaded binaries
  // if autoDownload is false this option can be ignored
  verifyChecksums: true,

  // settings for protocol node
  // notice that mnemonic and keyfile is missing, those need to be files under the secrets directory
  protocolNode: {
    // the ID of the pool you want to join as a validator
    // an overview of all pools can be found here -> https://app.kyve.network
    pool: 0,

    // the network you want to run on
    // currently only the testnet network "beta" is available
    network: "beta",

    // specify verbose logging
    // is often recommended in order to have a more detailed insight
    verbose: true,

    // specify if local prometheus metrics server should run
    // metric server will start on http:localhost:8080/metrics
    metrics: true,
  },
};

export default config;
