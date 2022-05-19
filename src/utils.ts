import axios from "axios";
import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import { Logger } from "tslog";

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getPool = async (
  endpoint: string,
  poolId: number,
  logger: Logger
): Promise<any> => {
  logger.info("Attempting to fetch pool state.");

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
          logger.error(`Failed to parse the pool config: ${pool?.config}`);
          pool.config = {};
        }

        try {
          pool.protocol.binaries = JSON.parse(pool.protocol.binaries);
        } catch (error) {
          logger.error(
            `Failed to parse the pool binaries: ${pool?.protocol.binaries}`
          );
          pool.protocol.binaries = {};
        }

        logger.info("Fetched pool state");

        data = pool;
        break;
      } catch (error) {
        logger.error(
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

export const startChildProcess = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      const child = spawn(command, args, options);

      child.stdout.pipe(process.stdout);
      child.stderr.pipe(process.stderr);

      child.stderr.on("data", (data: Buffer) => {
        if (data.toString().includes("Running an invalid version.")) {
          child.kill();
          resolve();
        }
      });

      child.on("error", (err) => {
        child.kill();
        reject(err);
      });

      child.on("close", () => {
        child.kill();
        reject();
      });
    } catch (err) {
      reject(err);
    }
  });
};
