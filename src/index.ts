import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
} from "fs";
import download from "download";
import { getChecksum, getPool, startChildProcess } from "./utils";
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

  while (true) {
    // create pool directory if it does not exist yet
    if (!existsSync("./runtimes")) {
      logger.info(`Creating "runtimes" directory ...`);
      mkdirSync("./runtimes");
    }

    // fetch pool state to get version
    // TODO: hardcode URL until new sdk gets released
    const pool = await getPool(
      `https://api.${config.protocolNode.network}.kyve.network`,
      config.protocolNode.pool,
      logger
    );

    const runtime = pool.data.runtime;
    const version = pool.data.protocol.version;

    if (!runtime) {
      logger.error("Runtime not found on pool. Exiting KYSOR ...");
      process.exit(0);
    }

    if (!version) {
      logger.error("Version tag not found on pool. Exiting KYSOR ...");
      process.exit(0);
    }

    // create pool runtime directory if does not exist yet
    if (!existsSync(`./runtimes/${runtime}`)) {
      mkdirSync(`./runtimes/${runtime}`, { recursive: true });
    }

    // check if directory with version already exists
    if (existsSync(`./runtimes/${runtime}/${version}`)) {
      logger.info(
        `Binary of runtime "${runtime}" with version ${version} found locally`
      );
    } else {
      logger.info(
        `Binary of runtime "${runtime}" with version ${version} not found locally`
      );

      // if binary needs to be downloaded and autoDownload is disable exit
      if (!config.autoDownload) {
        logger.error("Auto download is disabled. Exiting KYSOR ...");
        process.exit(0);
      }

      const downloadLink = pool.data.protocol.binaries[config.hostTarget];

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
      mkdirSync(`./runtimes/${runtime}/${version}`);

      // try to download binary
      try {
        logger.info(`Downloading ${downloadLink} ...`);

        writeFileSync(
          `./runtimes/${runtime}/${version}/kyve.zip`,
          await download(downloadLink)
        );
      } catch (err) {
        logger.error(
          `Error downloading binary from ${downloadLink}. Exiting KYSOR ...`
        );
        logger.error(err);

        // exit and delete version folders if binary could not be downloaded
        rmdirSync(`./runtimes/${runtime}/${version}`);
        process.exit(0);
      }

      try {
        logger.info(
          `Extracting binary to "./runtimes/${runtime}/${version}/kyve.zip" ...`
        );
        await extract(`./runtimes/${runtime}/${version}/kyve.zip`, {
          dir: path.resolve(`./runtimes/${runtime}/${version}/`),
        });

        // check if kyve.zip exists
        if (existsSync(`./runtimes/${runtime}/${version}/kyve.zip`)) {
          logger.info(`Deleting kyve.zip ...`);
          // delete zip afterwards
          unlinkSync(`./runtimes/${runtime}/${version}/kyve.zip`);
        }
      } catch (err) {
        logger.error("Error extracting binary to bin. Exiting KYSOR ...");
        logger.error(err);

        // exit and delete version folders if binary could not be extracted
        rmdirSync(`./runtimes/${runtime}/${version}`);
        process.exit(0);
      }

      const binName = readdirSync(`./runtimes/${runtime}/${version}/`)[0];
      const binPath = `./runtimes/${runtime}/${version}/${binName}`;

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
      const binName = readdirSync(`./runtimes/${runtime}/${version}/`)[0];
      const binPath = `./runtimes/${runtime}/${version}/${binName}`;

      const args = [
        `start`,
        `--pool`,
        `${config.protocolNode.pool}`,
        `--account`,
        `${config.protocolNode.account}`,
        `--wallet`,
        `${config.protocolNode.wallet}`,
        `--network`,
        `${config.protocolNode.network}`,
      ];

      if (config.protocolNode.config) {
        args.push("--config");
        args.push(`${config.protocolNode.config}`);
      }

      if (config.protocolNode.usePassword) {
        args.push("--use-password");
        args.push(`${config.protocolNode.usePassword}`);
      }

      if (config.protocolNode.verbose) {
        args.push("--verbose");
      }

      if (config.protocolNode.metrics) {
        args.push("--metrics");
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
