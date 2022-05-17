import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  renameSync,
} from "fs";
import download from "download";
import { parseOptions, getPool } from "./utils";
import { KyveSDK, KyveWallet } from "@kyve/sdk";
// import decompress from "decompress";
import extract from "extract-zip";
import path from "path";

const main = async () => {
  console.log("Starting Kaiser ...");

  const options = parseOptions();

  const wallet = new KyveWallet(options.network, options.mnemonic);
  const sdk = new KyveSDK(wallet);

  if (!existsSync("./kaiser")) {
    mkdirSync("./kaiser");
  }

  if (options.poolId === undefined) {
    console.log("PoolId undefined");
    process.exit(1);
  }

  if (options.target !== "macos" && options.target !== "linux") {
    console.log("Unknown target");
    process.exit(1);
  }

  if (!existsSync(`./kaiser/pool-id-${options.poolId}`)) {
    mkdirSync(`./kaiser/pool-id-${options.poolId}`);
  }

  const pool = await getPool(wallet.getRestEndpoint(), options.poolId);

  if (!pool.config.version?.tag) {
    console.log("Version tag not found");
    process.exit(1);
  }

  if (
    existsSync(`./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}`)
  ) {
    console.log("Version already exists. Skipping download ...");
  } else {
    mkdirSync(`./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}`);

    try {
      console.log("Downloading binary ...");
      writeFileSync(
        `./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}/kyve.zip`,
        await download(pool.config.version?.[options.target])
      );
    } catch (err) {
      console.log("Error downloading binary. Exiting ...");
      process.exit(1);
    }

    try {
      console.log("Extracting binary ...");
      await extract(
        `./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}/kyve.zip`,
        {
          dir: path.resolve(
            `./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}/bin/`
          ),
        }
      );
      readdirSync(
        `./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}/bin/`
      ).forEach((file) => {
        console.log(`Renaming ${file} ...`);
        renameSync(
          `./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}/bin/${file}`,
          `./kaiser/pool-id-${options.poolId}/${pool.config.version?.tag}/bin/kyve`
        );
      });
    } catch (err) {
      console.log("Error downloading binary. Exiting ...");
      process.exit(1);
    }
  }
};

main();
