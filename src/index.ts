import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  renameSync,
} from "fs";
import download from "download";
import { parseOptions, getPool, startProcess } from "./utils";
import { KyveSDK, KyveWallet } from "@kyve/sdk";
// import decompress from "decompress";
import extract from "extract-zip";
import path from "path";

const main = async () => {
  console.log("Starting Kaiser ...");

  const options = parseOptions();

  const wallet = new KyveWallet(options.network, options.mnemonic);

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

  if (!pool.protocol.version) {
    console.log("Version tag not found");
    process.exit(1);
  }

  if (
    existsSync(`./kaiser/pool-id-${options.poolId}/${pool.protocol.version}`)
  ) {
    console.log(
      `Binary with version ${pool.protocol.version} already exists. Skipping download ...`
    );
  } else {
    mkdirSync(`./kaiser/pool-id-${options.poolId}/${pool.protocol.version}`);

    try {
      console.log("Downloading binary ...");
      writeFileSync(
        `./kaiser/pool-id-${options.poolId}/${pool.protocol.version}/kyve.zip`,
        await download(pool.config.version?.[options.target])
      );
    } catch (err) {
      console.log("Error downloading binary. Exiting ...");
      process.exit(1);
    }

    try {
      console.log("Extracting binary ...");
      await extract(
        `./kaiser/pool-id-${options.poolId}/${pool.protocol.version}/kyve.zip`,
        {
          dir: path.resolve(
            `./kaiser/pool-id-${options.poolId}/${pool.protocol.version}/`
          ),
        }
      );
      readdirSync(
        `./kaiser/pool-id-${options.poolId}/${pool.protocol.version}/`
      ).forEach((file) => {
        console.log(`Renaming ${file} ...`);
        renameSync(
          `./kaiser/pool-id-${options.poolId}/${pool.protocol.version}/${file}`,
          `./kaiser/pool-id-${options.poolId}/${pool.protocol.version}/kyve`
        );
      });
    } catch (err) {
      console.log("Error downloading binary. Exiting ...");
      process.exit(1);
    }
  }

  try {
    const command = "./kyve";
    const args = [`--keyfile`, `./../../keys/arweave.json`];

    if (options.poolId) {
      args.push("--poolId");
      args.push(`${options.poolId}`);
    }

    if (options.mnemonic) {
      args.push("--mnemonic");
      args.push(`${options.mnemonic}`);
    }

    if (options.network) {
      args.push("--network");
      args.push(`${options.network}`);
    }

    if (options.initialStake) {
      args.push("--initialStake");
      args.push(`${options.initialStake}`);
    }

    if (options.space) {
      args.push("--space");
      args.push(`${options.space}`);
    }

    if (options.batchSize) {
      args.push("--batchSize");
      args.push(`${options.batchSize}`);
    }

    if (options.metrics) {
      args.push("--metrics");
    }

    if (options.verbose) {
      args.push("--verbose");
    }

    await startProcess(command, args, {
      cwd: `./kaiser/pool-id-${options.poolId}/${pool.protocol.version}/`,
    });
  } catch (err) {
    console.log("Found unexpected error. Exiting ...");
    process.exit(1);
  }

  console.log("done");
};

main();
