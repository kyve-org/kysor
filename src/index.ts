import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmdirSync,
} from "fs";
import download from "download";
import { parseOptions, getPool, startChildProcess } from "./utils";
import { KyveWallet } from "@kyve/sdk";
import extract from "extract-zip";
import path from "path";
import { Logger } from "tslog";

const logger: Logger = new Logger({
  displayFilePath: "hidden",
  displayFunctionName: false,
  logLevelsColors: {
    0: "white",
    1: "white",
    2: "white",
    3: "white",
    4: "white",
    5: "white",
    6: "white",
  },
});

const main = async () => {
  logger.info("Starting Kaiser ...");

  const options = parseOptions();

  const wallet = new KyveWallet(options.network, options.mnemonic);

  while (true) {
    logger.info("Looking for new version ...");

    if (!existsSync("./kaiser")) {
      mkdirSync("./kaiser");
      mkdirSync("./kaiser/keys");
      mkdirSync("./kaiser/pools");
    }

    if (options.poolId === undefined) {
      logger.error("PoolId undefined");
      process.exit(1);
    }

    if (options.target !== "macos" && options.target !== "linux") {
      logger.error("Unknown target");
      process.exit(1);
    }

    if (!existsSync(`./kaiser/pools/${options.poolId}`)) {
      mkdirSync(`./kaiser/pools/${options.poolId}`);
    }

    const pool = await getPool(
      wallet.getRestEndpoint(),
      options.poolId,
      logger
    );

    if (!pool.protocol.version) {
      logger.error("Version tag not found");
      process.exit(1);
    }

    if (
      existsSync(`./kaiser/pools/${options.poolId}/${pool.protocol.version}`)
    ) {
      logger.info(
        `Binary with version ${pool.protocol.version} already exists. Skipping download ...`
      );
    } else {
      logger.info(`Found new version = ${pool.protocol.version}`);

      if (pool.protocol.binaries[options.target]) {
        logger.info(
          `Found new binary = ${
            pool.protocol.binaries[options.target]
          }. Downloading ...`
        );

        mkdirSync(`./kaiser/pools/${options.poolId}/${pool.protocol.version}`);
        mkdirSync(
          `./kaiser/pools/${options.poolId}/${pool.protocol.version}/bin`
        );

        try {
          writeFileSync(
            `./kaiser/pools/${options.poolId}/${pool.protocol.version}/kyve.zip`,
            await download(pool.protocol.binaries[options.target])
          );
        } catch (err) {
          logger.error(
            `Error downloading binary from ${
              pool.protocol.binaries[options.target]
            }. Exiting Kaiser ...`
          );
          logger.error(err);
          rmdirSync(
            `./kaiser/pools/${options.poolId}/${pool.protocol.version}`
          );
          process.exit(1);
        }

        try {
          logger.info("Extracting binary ...");
          await extract(
            `./kaiser/pools/${options.poolId}/${pool.protocol.version}/kyve.zip`,
            {
              dir: path.resolve(
                `./kaiser/pools/${options.poolId}/${pool.protocol.version}/bin/`
              ),
            }
          );
        } catch (err) {
          logger.error("Error extracting binary. Exiting Kaiser ...");
          process.exit(1);
        }
      } else {
        logger.error("No upgrade binaries found. Exiting Kaiser ...");
        process.exit(1);
      }
    }

    try {
      const command = `./pools/${options.poolId}/${pool.protocol.version}/bin/${
        readdirSync(
          `./kaiser/pools/${options.poolId}/${pool.protocol.version}/bin/`
        )[0]
      }`;
      const args = [`--keyfile`, `./keys/arweave.json`];

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

      logger.info("Starting child process ...");

      console.log("\n\n");

      await startChildProcess(command, args, {
        cwd: `./kaiser/`,
      });

      console.log("\n\n");

      logger.info("Stopped child process ...");
    } catch (err) {
      logger.error("Found unexpected runtime error. Exiting Kaiser ...");
      logger.error(err);
      process.exit(1);
    }
  }
};

main();
