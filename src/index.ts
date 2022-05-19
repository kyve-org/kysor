import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmdirSync,
  readFileSync,
} from "fs";
import download from "download";
import { getPool, startChildProcess } from "./utils";
import { KyveWallet } from "@kyve/sdk";
import extract from "extract-zip";
import path from "path";
import { Logger } from "tslog";
import config from "./../kaiser.conf";

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
  logger.info("Validating files ...");

  if (!existsSync("./kaiser.conf.ts")) {
    logger.error(`Config file "kaiser.conf.ts" missing in home directory`);
    process.exit(1);
  }

  logger.info("Found kaiser.conf.ts");

  if (!existsSync("./secrets")) {
    logger.error(`Directory "secrets" missing. Exiting Kaiser ...`);
    process.exit(1);
  }

  if (!existsSync("./secrets/arweave.json")) {
    logger.error(
      `Secret "arweave.json" missing in secrets directory. Exiting Kaiser ...`
    );
    process.exit(1);
  }

  logger.info("Found arweave.json");

  if (!existsSync("./secrets/mnemonic.txt")) {
    logger.error(
      `Secret "mnemonic.txt" missing in secrets directory. Exiting Kaiser ...`
    );
    process.exit(1);
  }

  logger.info("Found mnemonic.txt");

  const mnemonic = readFileSync("./secrets/mnemonic.txt", "utf-8");
  const wallet = new KyveWallet(config.protocolNode.network, mnemonic);

  while (true) {
    // create pool directory if it does not exist yet
    if (!existsSync("./pools")) {
      logger.info(`Creating "pools" directory ...`);
      mkdirSync("./pools");
    }

    // create pool id directory if does not exist yet
    if (!existsSync(`./pools/${config.protocolNode.poolId}`)) {
      mkdirSync(`./pools/${config.protocolNode.poolId}`);
    }

    // fetch pool state to get version
    const pool = await getPool(
      wallet.getRestEndpoint(),
      config.protocolNode.poolId,
      logger
    );

    if (!pool.protocol.version) {
      logger.error("Version tag not found on pool. Exiting Kaiser ...");
      process.exit(0);
    }

    if (
      existsSync(
        `./pools/${config.protocolNode.poolId}/${pool.protocol.version}`
      )
    ) {
      logger.info(`Binary with version ${pool.protocol.version} found locally`);
    } else {
      logger.info(
        `Binary with version ${pool.protocol.version} not found locally`
      );

      if (config.autoDownload) {
        if (pool.protocol.binaries[config.hostTarget]) {
          logger.info("Found downloadable binary on pool");

          mkdirSync(
            `./pools/${config.protocolNode.poolId}/${pool.protocol.version}`
          );
          mkdirSync(
            `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin`
          );

          try {
            logger.info(
              `Downloading ${pool.protocol.binaries[config.hostTarget]} ...`
            );
            writeFileSync(
              `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/kyve.zip`,
              await download(pool.protocol.binaries[config.hostTarget])
            );
          } catch (err) {
            logger.error(
              `Error downloading binary from ${
                pool.protocol.binaries[config.hostTarget]
              }. Exiting Kaiser ...`
            );
            logger.error(err);
            rmdirSync(
              `./pools/${config.protocolNode.poolId}/${pool.protocol.version}`
            );
            process.exit(0);
          }

          try {
            logger.info("Extracting binary to bin ...");
            await extract(
              `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/kyve.zip`,
              {
                dir: path.resolve(
                  `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin/`
                ),
              }
            );
          } catch (err) {
            logger.error("Error extracting binary to bin. Exiting Kaiser ...");
            logger.error(err);
            process.exit(0);
          }
        } else {
          logger.error("No upgrade binaries found on pool. Exiting Kaiser ...");
          process.exit(0);
        }
      } else {
        logger.error("Auto download is disabled. Exiting Kaiser ...");
        process.exit(0);
      }
    }

    try {
      const command = `./pools/${config.protocolNode.poolId}/${
        pool.protocol.version
      }/bin/${
        readdirSync(
          `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin/`
        )[0]
      }`;
      const args = [
        `--poolId`,
        `${config.protocolNode.poolId}`,
        `--mnemonic`,
        `${mnemonic}`,
        `--network`,
        `${config.protocolNode.network}`,
        `--keyfile`,
        `./secrets/arweave.json`,
      ];

      if (config.protocolNode.initialStake) {
        args.push("--initialStake");
        args.push(`${config.protocolNode.initialStake}`);
      }

      if (config.protocolNode.space) {
        args.push("--space");
        args.push(`${config.protocolNode.space}`);
      }

      if (config.protocolNode.verbose) {
        args.push("--verbose");
      }

      logger.info("Starting child process ...");

      console.log("\n\n");

      await startChildProcess(command, args, {});

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
