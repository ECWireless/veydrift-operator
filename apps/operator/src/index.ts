import {
  type PlayerIdentity,
  PlayerIdentityConfigurationError,
  readPlayerIdentity,
} from "./identity.ts";

export const OPERATOR_NAME = "Veydrift Operator";

export interface OperatorLogger {
  error(message: string): void;
  info(message: string): void;
}

export function createStartupMessage(identity: PlayerIdentity): string {
  return `${OPERATOR_NAME} is ready for ${identity.playerAddress}`;
}

export function runOperator(
  environment: Readonly<Record<string, string | undefined>>,
  logger: OperatorLogger,
): 0 | 1 {
  try {
    const identity = readPlayerIdentity(environment);
    logger.info(createStartupMessage(identity));
    return 0;
  } catch (error) {
    const message =
      error instanceof PlayerIdentityConfigurationError
        ? error.message
        : `${OPERATOR_NAME} failed to start`;

    logger.error(message);
    return 1;
  }
}

export function main(): void {
  process.exitCode = runOperator(process.env, console);
}

if (import.meta.main) {
  main();
}
