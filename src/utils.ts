import axios from "axios";
import { spawn, SpawnOptionsWithoutStdio } from "child_process";
import { Logger } from "tslog";
import crypto from "crypto";
import { createReadStream } from "fs";

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
        } = await axios.get(`${endpoint}/kyve/query/v1beta1/pool/${poolId}`);

        try {
          pool.data.config = JSON.parse(pool.data.config);
        } catch (error) {
          logger.error(`Failed to parse the pool config: ${pool?.data.config}`);
          pool.data.config = {};
        }

        try {
          pool.data.protocol.binaries = JSON.parse(pool.data.protocol.binaries);
        } catch (error) {
          logger.error(
            `Failed to parse the pool binaries: ${pool?.data.protocol.binaries}`
          );
          pool.data.protocol.binaries = {};
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

export const startNodeProcess = (
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
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
};

export const getChecksum = (path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = createReadStream(path);

    input.on("error", reject);

    input.on("data", (chunk: Buffer) => {
      hash.update(chunk);
    });

    input.on("close", () => {
      resolve(hash.digest("hex"));
    });
  });
};
