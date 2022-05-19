import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmdirSync,
  readFileSync,
} from "fs";
import download from "download";
import { getChecksum, getPool, startChildProcess } from "./utils";
import { KyveWallet } from "@kyve/sdk";
import extract from "extract-zip";
import path from "path";
import { Logger } from "tslog";
import config from "./../kaiser.conf";
import { URLSearchParams } from "url";

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

    // check if directory with version already exists
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

      // if binary needs to be downloaded and autoDownload is disable exit
      if (!config.autoDownload) {
        logger.error("Auto download is disabled. Exiting Kaiser ...");
        process.exit(0);
      }

      const downloadLink = pool.protocol.binaries[config.hostTarget];

      // if download link was not found exit
      if (!downloadLink) {
        logger.error("No upgrade binaries found on pool. Exiting Kaiser ...");
        process.exit(0);
      }

      logger.info("Found downloadable binary on pool");

      const checksum = new URL(downloadLink).searchParams.get("checksum") || "";

      // if checksum was not found and verifyChecksums is enabled exit
      if (!checksum && config.verifyChecksums) {
        logger.error("No checksum found on binary. Exiting Kaiser ...");
        process.exit(0);
      }

      // create directories for new version
      mkdirSync(
        `./pools/${config.protocolNode.poolId}/${pool.protocol.version}`
      );
      mkdirSync(
        `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin`
      );

      // try to download binary
      try {
        logger.info(`Downloading ${downloadLink} ...`);

        writeFileSync(
          `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/kyve.zip`,
          await download(downloadLink)
        );
      } catch (err) {
        logger.error(
          `Error downloading binary from ${downloadLink}. Exiting Kaiser ...`
        );
        logger.error(err);

        // exit and delete version folders if binary could not be downloaded
        rmdirSync(
          `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin`
        );
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

        // exit and delete version folders if binary could not be extracted
        rmdirSync(
          `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin`
        );
        rmdirSync(
          `./pools/${config.protocolNode.poolId}/${pool.protocol.version}`
        );
        process.exit(0);
      }

      const binName = readdirSync(
        `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin/`
      )[0];
      const binPath = `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin/${binName}`;

      if (config.verifyChecksums) {
        const localChecksum = await getChecksum(binPath);

        logger.info("Comparing binary checksums ...");
        console.log();
        logger.info(`Provided checksum  = ${checksum}`);
        logger.info(`Local checksum     = ${localChecksum}`);
        console.log();

        if (checksum === localChecksum) {
          logger.info("Checksums are equal. Continuing ...");
        } else {
          logger.info("Checksums are not equal. Exiting Kaiser ...");
          process.exit(0);
        }
      }
    }

    try {
      const binName = readdirSync(
        `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin/`
      )[0];
      const binPath = `./pools/${config.protocolNode.poolId}/${pool.protocol.version}/bin/${binName}`;

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

      console.log("\n");

      await startChildProcess(binPath, args, {});

      console.log("\n");

      logger.info("Stopped child process ...");
    } catch (err) {
      logger.error("Found unexpected runtime error. Exiting Kaiser ...");
      logger.error(err);
      process.exit(1);
    }
  }
};

main();
