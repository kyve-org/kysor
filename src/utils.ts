import axios from "axios";
import {
  ChildProcessWithoutNullStreams,
  spawn,
  SpawnOptionsWithoutStdio,
} from "child_process";
import { program } from "commander";

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const parseOptions = () => {
  program
    .requiredOption(
      "--target <string>",
      "The target of the binaries [linux, macos]."
    )
    .requiredOption(
      "-p, --poolId <number>",
      "The id of the pool you want to run on."
    )
    .requiredOption("-m, --mnemonic <string>", "Your mnemonic of your account.")
    .option(
      "-s, --initialStake <number>",
      "Your initial stake the node should start with. Flag is ignored node is already staked [unit = $KYVE]."
    )
    .option(
      "-n, --network <string>",
      "The chain id of the network. [optional, default = korellia]",
      "korellia"
    )
    .option(
      "-sp, --space <number>",
      "The size of disk space in bytes the node is allowed to use. [optional, default = 1000000000 (1 GB)]",
      "1000000000"
    )
    .option(
      "-b, --batchSize <number>",
      "The batch size of fetching items from datasource. For synchronous fetching enter 1. [optional, default = 1]",
      "1"
    )
    .option(
      "--metrics",
      "Run Prometheus metrics server. [optional, default = false]",
      false
    )
    .option(
      "-v, --verbose",
      "Run node in verbose mode. [optional, default = false]",
      false
    );

  program.parse();
  return program.opts();
};

export const getPool = async (
  endpoint: string,
  poolId: string
): Promise<any> => {
  console.log("Attempting to fetch pool state.");

  return new Promise(async (resolve) => {
    let requests = 1;
    let data = {};

    while (true) {
      try {
        const {
          data: { pool },
        } = await axios.get(`${endpoint}/kyve/registry/v1beta1/pool/${poolId}`);

        try {
          pool.config = JSON.parse(pool.config);
        } catch (error) {
          console.log(`Failed to parse the pool config: ${pool?.config}`);
          pool.config = {};
        }

        console.log("Fetched pool state");

        data = pool;
        break;
      } catch (error) {
        console.log(
          `Failed to fetch pool state. Retrying in ${requests * 10}s ...`
        );
        await sleep(requests * 10 * 1000);

        // limit timeout to 5 mins
        if (requests < 30) {
          requests++;
        }
      }
    }

    resolve(data);
  });
};

export const startProcess = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      console.log("Starting child process ...");

      const child = spawn(command, args, options);

      child.stdout.pipe(process.stdout);
      child.stderr.pipe(process.stderr);

      child.stderr.on("data", (data: Buffer) => {
        if (data.toString().includes("Running an invalid version.")) {
          console.log("Found invalid version. Stopping ...");
          child.kill();
          resolve();
        }
      });

      child.on("error", (err) => {
        reject(err);
      });

      child.on("close", () => {
        reject();
      });
    } catch (err) {
      reject(err);
    }
  });
};
