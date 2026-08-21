import { describe, expect, test } from "bun:test";

import { PLAYER_ADDRESS_ENV_VAR } from "../src/identity.ts";
import {
  DEFAULT_OPERATOR_PORT,
  OPERATOR_HOSTNAME,
  OPERATOR_PORT_ENV_VAR,
  OperatorPortConfigurationError,
  OperatorRuntime,
  type OperatorServerFactory,
  type OperatorWorker,
  readOperatorRuntimeConfiguration,
} from "../src/operator-runtime.ts";
import { SNAPSHOT_READ_API_PATH } from "../src/snapshot-read-api.ts";
import { SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR } from "../src/snapshot-worker.ts";

const PLAYER_ADDRESS = "0x1111111111111111111111111111111111111111";

describe("operator runtime configuration", () => {
  test("uses loopback defaults and accepts bounded overrides", () => {
    const defaults = readOperatorRuntimeConfiguration({
      [PLAYER_ADDRESS_ENV_VAR]: PLAYER_ADDRESS,
    });
    const overridden = readOperatorRuntimeConfiguration({
      [PLAYER_ADDRESS_ENV_VAR]: PLAYER_ADDRESS,
      [OPERATOR_PORT_ENV_VAR]: "4321",
      [SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR]: "900",
    });

    expect(defaults).toEqual({
      playerAddress: PLAYER_ADDRESS,
      port: DEFAULT_OPERATOR_PORT,
      refreshIntervalSeconds: 60,
    });
    expect(Object.isFrozen(defaults)).toBe(true);
    expect(overridden).toEqual({
      playerAddress: PLAYER_ADDRESS,
      port: 4321,
      refreshIntervalSeconds: 900,
    });
    expect(OPERATOR_HOSTNAME).toBe("127.0.0.1");
  });

  for (const invalidPort of ["0", "65536", "30.5", "-1", "not-a-port"]) {
    test(`rejects invalid port ${invalidPort} without echoing it`, () => {
      expectConfigurationError(invalidPort);
    });
  }
});

describe("operator runtime lifecycle", () => {
  test("starts the worker after binding loopback and stops both resources", async () => {
    const worker = new FakeWorker();
    const serverState = {
      options: null as Parameters<OperatorServerFactory>[0] | null,
      stopCalls: [] as Array<boolean | undefined>,
    };
    const runtime = new OperatorRuntime({
      port: 0,
      worker,
      serverFactory: (options) => {
        serverState.options = options;
        return {
          port: 4321,
          stop: (closeActiveConnections) => {
            serverState.stopCalls.push(closeActiveConnections);
          },
        };
      },
    });

    runtime.start();

    expect(serverState.options).toMatchObject({
      hostname: OPERATOR_HOSTNAME,
      port: 0,
    });
    expect(worker.startCalls).toBe(1);
    expect(runtime.url).toBe("http://127.0.0.1:4321");

    await runtime.stop();

    expect(worker.stopCalls).toBe(1);
    expect(serverState.stopCalls).toEqual([undefined]);
    expect(runtime.url).toBeNull();
  });

  test("closes a bound server when worker startup throws", () => {
    const sensitiveValue = "synthetic-worker-start-failure";
    const worker = new FakeWorker();
    worker.startError = new Error(sensitiveValue);
    let serverStopped = false;
    const runtime = new OperatorRuntime({
      port: 3000,
      worker,
      serverFactory: () => ({
        port: 3000,
        stop: () => {
          serverStopped = true;
        },
      }),
    });

    expect(() => runtime.start()).toThrow(sensitiveValue);
    expect(serverStopped).toBe(true);
    expect(runtime.url).toBeNull();
  });

  test("serves the read API through an actual loopback listener", async () => {
    const worker = new FakeWorker();
    const runtime = new OperatorRuntime({ port: 0, worker });
    runtime.start();

    try {
      const response = await fetch(`${runtime.url}${SNAPSHOT_READ_API_PATH}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        apiVersion: 1,
        status: { phase: "starting", hasSnapshot: false },
        snapshot: null,
        digest: null,
      });
    } finally {
      await runtime.stop();
    }

    expect(worker.startCalls).toBe(1);
    expect(worker.stopCalls).toBe(1);
  });
});

class FakeWorker implements OperatorWorker {
  startCalls = 0;
  stopCalls = 0;
  startError: Error | null = null;

  start(): Promise<void> {
    this.startCalls += 1;
    if (this.startError !== null) throw this.startError;
    return Promise.resolve();
  }

  stop(): void {
    this.stopCalls += 1;
  }

  view() {
    return {
      snapshot: null,
      status: {
        phase: "starting" as const,
        attempts: 0,
        consecutiveFailures: 0,
        hasSnapshot: false,
        lastAttemptAt: null,
        lastError: null,
        lastSuccessAt: null,
        nextRefreshAt: null,
        refreshIntervalSeconds: 60,
        retainedAfterFailure: false,
        sourcePartial: false,
        sourceStale: false,
      },
    };
  }
}

function expectConfigurationError(invalidPort: string): void {
  try {
    readOperatorRuntimeConfiguration({
      [PLAYER_ADDRESS_ENV_VAR]: PLAYER_ADDRESS,
      [OPERATOR_PORT_ENV_VAR]: invalidPort,
    });
  } catch (error) {
    expect(error).toBeInstanceOf(OperatorPortConfigurationError);
    expect((error as Error).message).not.toContain(invalidPort);
    return;
  }

  throw new Error("Expected operator configuration to fail");
}
