import {
  type PlayerIdentity,
  PlayerIdentityConfigurationError,
} from "./identity.ts";
import {
  createOperatorRuntime,
  type OperatorRuntimeConfiguration,
  OperatorPortConfigurationError,
  readOperatorRuntimeConfiguration,
} from "./operator-runtime.ts";
import { SnapshotWorkerConfigurationError } from "./snapshot-worker.ts";

export const OPERATOR_NAME = "Veydrift Operator";

export interface OperatorLogger {
  error(message: string): void;
  info(message: string): void;
}

export interface OperatorRuntimeController {
  readonly url: string | null;
  start(): void;
  stop(): Promise<void>;
}

export type OperatorRuntimeFactory = (
  configuration: OperatorRuntimeConfiguration,
) => OperatorRuntimeController;

export interface OperatorStartResult {
  readonly exitCode: 0 | 1;
  readonly runtime: OperatorRuntimeController | null;
}

export function createStartupMessage(
  identity: PlayerIdentity,
  url: string,
): string {
  return `${OPERATOR_NAME} is ready for ${identity.playerAddress} at ${url}`;
}

export function startOperator(
  environment: Readonly<Record<string, string | undefined>>,
  logger: OperatorLogger,
  runtimeFactory: OperatorRuntimeFactory = createOperatorRuntime,
): OperatorStartResult {
  let runtime: OperatorRuntimeController | null = null;
  try {
    const configuration = readOperatorRuntimeConfiguration(environment);
    runtime = runtimeFactory(configuration);
    runtime.start();
    const url = runtime.url;
    if (url === null) throw new Error("Operator runtime did not start");
    logger.info(createStartupMessage(configuration, url));
    return Object.freeze({ exitCode: 0, runtime });
  } catch (error) {
    if (runtime !== null) {
      void runtime.stop().catch(() => undefined);
    }
    const message =
      error instanceof PlayerIdentityConfigurationError ||
      error instanceof OperatorPortConfigurationError ||
      error instanceof SnapshotWorkerConfigurationError
        ? error.message
        : `${OPERATOR_NAME} failed to start`;

    logger.error(message);
    return Object.freeze({ exitCode: 1, runtime: null });
  }
}

export function main(): void {
  const result = startOperator(process.env, console);
  process.exitCode = result.exitCode;
  if (result.runtime === null) return;

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void result.runtime?.stop().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (import.meta.main) {
  main();
}
