import type { Address } from "viem";

import { readPlayerIdentity } from "./identity.ts";
import {
  FetchPublicApiAdapter,
  FetchPublicRpcAdapter,
} from "./public-read-adapters.ts";
import { OneShotSnapshotCollector } from "./snapshot-collector.ts";
import {
  createSnapshotReadHandler,
  type SnapshotViewProvider,
} from "./snapshot-read-api.ts";
import {
  readSnapshotWorkerConfiguration,
  SnapshotWorker,
  type SnapshotWorkerConfiguration,
} from "./snapshot-worker.ts";
import { SUPPORTED_DEPLOYMENT } from "./supported-deployment.ts";

export const OPERATOR_HOSTNAME = "127.0.0.1";
export const OPERATOR_PORT_ENV_VAR = "VEYDRIFT_OPERATOR_PORT";
export const DEFAULT_OPERATOR_PORT = 3_000;

export interface OperatorRuntimeConfiguration
  extends SnapshotWorkerConfiguration {
  readonly playerAddress: Address;
  readonly port: number;
}

export interface OperatorWorker extends SnapshotViewProvider {
  start(): Promise<void>;
  stop(): void;
}

export interface OperatorServer {
  readonly port: number;
  stop(closeActiveConnections?: boolean): Promise<void> | void;
}

export interface OperatorServerOptions {
  readonly fetch: (request: Request) => Response | Promise<Response>;
  readonly hostname: typeof OPERATOR_HOSTNAME;
  readonly port: number;
}

export type OperatorServerFactory = (
  options: OperatorServerOptions,
) => OperatorServer;

export interface OperatorRuntimeOptions {
  readonly port: number;
  readonly serverFactory?: OperatorServerFactory;
  readonly worker: OperatorWorker;
}

export class OperatorPortConfigurationError extends Error {
  constructor() {
    super(`${OPERATOR_PORT_ENV_VAR} must be an integer from 1 to 65535`);
    this.name = "OperatorPortConfigurationError";
  }
}

export class OperatorRuntime {
  readonly #configuredPort: number;
  readonly #serverFactory: OperatorServerFactory;
  readonly #worker: OperatorWorker;

  #server: OperatorServer | null = null;

  constructor(options: OperatorRuntimeOptions) {
    this.#configuredPort = validateRuntimePort(options.port);
    this.#worker = options.worker;
    this.#serverFactory = options.serverFactory ?? createBunServer;
  }

  get url(): string | null {
    return this.#server === null
      ? null
      : `http://${OPERATOR_HOSTNAME}:${this.#server.port}`;
  }

  start(): void {
    if (this.#server !== null) throw new Error("Operator runtime is started");

    const server = this.#serverFactory({
      hostname: OPERATOR_HOSTNAME,
      port: this.#configuredPort,
      fetch: createSnapshotReadHandler(this.#worker),
    });
    this.#server = server;
    try {
      void this.#worker.start().catch(() => {
        void this.#stopAfterWorkerStartupFailure(server).catch(() => undefined);
      });
    } catch (error) {
      this.#server = null;
      void Promise.resolve(server.stop(true)).catch(() => undefined);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.#worker.stop();
    const server = this.#server;
    this.#server = null;
    if (server !== null) await server.stop();
  }

  async #stopAfterWorkerStartupFailure(server: OperatorServer): Promise<void> {
    if (this.#server !== server) return;

    this.#server = null;
    try {
      this.#worker.stop();
    } finally {
      await server.stop(true);
    }
  }
}

export function readOperatorRuntimeConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<OperatorRuntimeConfiguration> {
  const identity = readPlayerIdentity(environment);
  const worker = readSnapshotWorkerConfiguration(environment);

  return Object.freeze({
    playerAddress: identity.playerAddress,
    refreshIntervalSeconds: worker.refreshIntervalSeconds,
    port: readPort(environment[OPERATOR_PORT_ENV_VAR]),
  });
}

export function createOperatorRuntime(
  configuration: OperatorRuntimeConfiguration,
): OperatorRuntime {
  const api = new FetchPublicApiAdapter(
    SUPPORTED_DEPLOYMENT.core.surfaces.apiUrl,
  );
  const rpc = new FetchPublicRpcAdapter(
    SUPPORTED_DEPLOYMENT.verification.rpcUrl,
  );
  const collector = new OneShotSnapshotCollector({ api, rpc });
  const worker = new SnapshotWorker({
    collector,
    playerAddress: configuration.playerAddress,
    refreshIntervalSeconds: configuration.refreshIntervalSeconds,
  });

  return new OperatorRuntime({ port: configuration.port, worker });
}

function readPort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort.trim() === "") {
    return DEFAULT_OPERATOR_PORT;
  }
  if (!/^[0-9]+$/.test(rawPort)) throw new OperatorPortConfigurationError();
  return validateConfiguredPort(Number(rawPort));
}

function validateConfiguredPort(port: number): number {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new OperatorPortConfigurationError();
  }
  return port;
}

function validateRuntimePort(port: number): number {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new OperatorPortConfigurationError();
  }
  return port;
}

function createBunServer(options: OperatorServerOptions): OperatorServer {
  const server = Bun.serve({
    hostname: options.hostname,
    port: options.port,
    fetch: options.fetch,
  });
  if (server.port === undefined) {
    void Promise.resolve(server.stop(true)).catch(() => undefined);
    throw new Error("Operator server did not bind a TCP port");
  }
  return {
    port: server.port,
    stop: (closeActiveConnections) => server.stop(closeActiveConnections),
  };
}
