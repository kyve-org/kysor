import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmdirSync,
  readFileSync,
  unlinkSync,
} from "fs";
import download from "download";
import { getChecksum, getPool, startChildProcess } from "./utils";
import { KyveWallet } from "@kyve/sdk";
import extract from "extract-zip";
import path from "path";
import { Logger } from "tslog";
import config from "./../kysor.conf";

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
  logger.info("Starting KYSOR ...");
  logger.info("Validating files ...");

  if (!existsSync("./kysor.conf.ts")) {
    logger.error(`Config file "kysor.conf.ts" missing in home directory`);
    process.exit(1);
  }

  logger.info("Found kysor.conf.ts");

  if (!existsSync("./secrets")) {
    logger.error(`Directory "secrets" missing. Exiting KYSOR ...`);
    process.exit(1);
  }

  if (!existsSync("./secrets/arweave.json")) {
    logger.error(
      `Secret "arweave.json" missing in secrets directory. Exiting KYSOR ...`
    );
    process.exit(1);
  }

  logger.info("Found arweave.json");

  if (!existsSync("./secrets/mnemonic.txt")) {
    logger.error(
      `Secret "mnemonic.txt" missing in secrets directory. Exiting KYSOR ...`
    );
    process.exit(1);
  }

  logger.info("Found mnemonic.txt");

  const mnemonic = readFileSync("./secrets/mnemonic.txt", "utf-8").trim();
  const wallet = new KyveWallet(config.protocolNode.network, mnemonic);

  while (true) {
    // create pool directory if it does not exist yet
    if (!existsSync("./runtimes")) {
      logger.info(`Creating "runtimes" directory ...`);
      mkdirSync("./runtimes");
    }

    // fetch pool state to get version
    const pool = await getPool(
      wallet.getRestEndpoint(),
      config.protocolNode.poolId,
      logger
    );

    if (!pool.protocol.version) {
      logger.error("Version tag not found on pool. Exiting KYSOR ...");
      process.exit(0);
    }

    // create pool runtime directory if does not exist yet
    if (!existsSync(`./runtimes/${pool.runtime}`)) {
      mkdirSync(`./runtimes/${pool.runtime}`, { recursive: true });
    }

    // check if directory with version already exists
    if (existsSync(`./runtimes/${pool.runtime}/${pool.protocol.version}`)) {
      logger.info(
        `Binary of runtime "${pool.runtime}" with version ${pool.protocol.version} found locally`
      );
    } else {
      logger.info(
        `Binary of runtime "${pool.runtime}" with version ${pool.protocol.version} not found locally`
      );

      // if binary needs to be downloaded and autoDownload is disable exit
      if (!config.autoDownload) {
        logger.error("Auto download is disabled. Exiting KYSOR ...");
        process.exit(0);
      }

      const downloadLink = pool.protocol.binaries[config.hostTarget];

      // if download link was not found exit
      if (!downloadLink) {
        logger.error("No upgrade binaries found on pool. Exiting KYSOR ...");
        process.exit(0);
      }

      logger.info("Found downloadable binary on pool");

      const checksum = new URL(downloadLink).searchParams.get("checksum") || "";

      // if checksum was not found and verifyChecksums is enabled exit
      if (!checksum && config.verifyChecksums) {
        logger.error("No checksum found on binary. Exiting KYSOR ...");
        process.exit(0);
      }

      // create directories for new version
      mkdirSync(`./runtimes/${pool.runtime}/${pool.protocol.version}`);

      // try to download binary
      try {
        logger.info(`Downloading ${downloadLink} ...`);

        writeFileSync(
          `./runtimes/${pool.runtime}/${pool.protocol.version}/kyve.zip`,
          await download(downloadLink)
        );
      } catch (err) {
        logger.error(
          `Error downloading binary from ${downloadLink}. Exiting KYSOR ...`
        );
        logger.error(err);

        // exit and delete version folders if binary could not be downloaded
        rmdirSync(`./runtimes/${pool.runtime}/${pool.protocol.version}`);
        process.exit(0);
      }

      try {
        logger.info(
          `Extracting binary to "./runtimes/${pool.runtime}/${pool.protocol.version}/kyve.zip" ...`
        );
        await extract(
          `./runtimes/${pool.runtime}/${pool.protocol.version}/kyve.zip`,
          {
            dir: path.resolve(
              `./runtimes/${pool.runtime}/${pool.protocol.version}/`
            ),
          }
        );

        // check if kyve.zip exists
        if (
          existsSync(
            `./runtimes/${pool.runtime}/${pool.protocol.version}/kyve.zip`
          )
        ) {
          logger.info(`Deleting kyve.zip ...`);
          // delete zip afterwards
          unlinkSync(
            `./runtimes/${pool.runtime}/${pool.protocol.version}/kyve.zip`
          );
        }
      } catch (err) {
        logger.error("Error extracting binary to bin. Exiting KYSOR ...");
        logger.error(err);

        // exit and delete version folders if binary could not be extracted
        rmdirSync(`./runtimes/${pool.runtime}/${pool.protocol.version}`);
        process.exit(0);
      }

      const binName = readdirSync(
        `./runtimes/${pool.runtime}/${pool.protocol.version}/`
      )[0];
      const binPath = `./runtimes/${pool.runtime}/${pool.protocol.version}/${binName}`;

      if (config.verifyChecksums) {
        const localChecksum = await getChecksum(binPath);

        logger.info("Comparing binary checksums ...");
        console.log();
        logger.info(`Found checksum = ${checksum}`);
        logger.info(`Local checksum = ${localChecksum}`);
        console.log();

        if (checksum === localChecksum) {
          logger.info("Checksums are equal. Continuing ...");
        } else {
          logger.info("Checksums are not equal. Exiting KYSOR ...");
          process.exit(0);
        }
      }
    }

    try {
      const binName = readdirSync(
        `./runtimes/${pool.runtime}/${pool.protocol.version}/`
      )[0];
      const binPath = `./runtimes/${pool.runtime}/${pool.protocol.version}/${binName}`;

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
      logger.error("Found unexpected runtime error. Exiting KYSOR ...");
      logger.error(err);
      process.exit(1);
    }
  }
};

main();
