import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  renameSync,
} from "fs";
import download from "download";
import { parseOptions, getPool, startChildProcess } from "./utils";
import { KyveWallet } from "@kyve/sdk";
import extract from "extract-zip";
import path from "path";

const main = async () => {
  console.log("Starting Kaiser ...");

  const options = parseOptions();

  const wallet = new KyveWallet(options.network, options.mnemonic);

  while (true) {
    if (!existsSync("./kaiser")) {
      mkdirSync("./kaiser");
      mkdirSync("./kaiser/keys");
      mkdirSync("./kaiser/pools");
    }

    if (options.poolId === undefined) {
      console.log("PoolId undefined");
      process.exit(1);
    }

    if (options.target !== "macos" && options.target !== "linux") {
      console.log("Unknown target");
      process.exit(1);
    }

    if (!existsSync(`./kaiser/pools/${options.poolId}`)) {
      mkdirSync(`./kaiser/pools/${options.poolId}`);
    }

    const pool = await getPool(wallet.getRestEndpoint(), options.poolId);

    if (!pool.protocol.version) {
      console.log("Version tag not found");
      process.exit(1);
    }

    if (
      existsSync(`./kaiser/pools/${options.poolId}/${pool.protocol.version}`)
    ) {
      console.log(
        `Binary with version ${pool.protocol.version} already exists. Skipping download ...`
      );
    } else {
      // mkdirSync(`./kaiser/pools/${options.poolId}/${pool.protocol.version}`);
      console.log(`Found new version = ${pool.protocol.version}`);

      if (pool.protocol.binaries[options.target]) {
        console.log(
          `Found new binary = ${
            pool.protocol.binaries[options.target]
          }. Downloading ...`
        );

        try {
          writeFileSync(
            `./kaiser/pools/${options.poolId}/${pool.protocol.version}/kyve.zip`,
            await download(pool.protocol.binaries[options.target])
          );
        } catch (err) {
          console.log(
            `Error downloading binary from ${
              pool.protocol.binaries[options.target]
            }. Exiting ...`
          );
          process.exit(1);
        }

        try {
          console.log("Extracting binary ...");
          await extract(
            `./kaiser/pools/${options.poolId}/${pool.protocol.version}/kyve.zip`,
            {
              dir: path.resolve(
                `./kaiser/pools/${options.poolId}/${pool.protocol.version}/`
              ),
            }
          );
          readdirSync(
            `./kaiser/pools/${options.poolId}/${pool.protocol.version}/`
          ).forEach((file) => {
            console.log(`Renaming ${file} ...`);
            renameSync(
              `./kaiser/pools/${options.poolId}/${pool.protocol.version}/${file}`,
              `./kaiser/pools/${options.poolId}/${pool.protocol.version}/kyve`
            );
          });
        } catch (err) {
          console.log("Error extracting binary. Exiting ...");
          process.exit(1);
        }
      } else {
        console.log("No upgrade binaries found. Exiting ...");
        process.exit(1);
      }
    }

    try {
      const command = "./kyve";
      const args = [`--keyfile`, `./../../../keys/arweave.json`];

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

      await startChildProcess(command, args, {
        cwd: `./kaiser/pools/${options.poolId}/${pool.protocol.version}/`,
      });
    } catch (err) {
      console.log("Found unexpected error. Exiting ...");
      process.exit(1);
    }

    console.log("done");
  }
};

main();
