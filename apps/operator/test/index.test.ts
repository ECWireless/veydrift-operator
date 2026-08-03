import { describe, expect, test } from "bun:test";

import {
  createStartupMessage,
  OPERATOR_NAME,
  type OperatorLogger,
  runOperator,
} from "../src/index.ts";
import { OPERATOR_PRIVATE_KEY_ENV_VAR } from "../src/identity.ts";

const SYNTHETIC_PRIVATE_KEY = `0x${"1".padStart(64, "0")}`;
const SYNTHETIC_WALLET_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";

function createMemoryLogger(): OperatorLogger & {
  errors: string[];
  messages: string[];
} {
  const errors: string[] = [];
  const messages: string[] = [];

  return {
    errors,
    messages,
    error: (message) => errors.push(message),
    info: (message) => messages.push(message),
  };
}

describe("operator startup", () => {
  test("reports only the derived public address", () => {
    const logger = createMemoryLogger();
    const exitCode = runOperator(
      { [OPERATOR_PRIVATE_KEY_ENV_VAR]: SYNTHETIC_PRIVATE_KEY },
      logger,
    );

    expect(exitCode).toBe(0);
    expect(logger.errors).toEqual([]);
    expect(logger.messages).toEqual([
      createStartupMessage({ walletAddress: SYNTHETIC_WALLET_ADDRESS }),
    ]);
    expect(logger.messages.join("\n")).toContain(SYNTHETIC_WALLET_ADDRESS);
    expect(logger.messages.join("\n")).not.toContain(SYNTHETIC_PRIVATE_KEY);
  });

  test("fails closed with a sanitized configuration error", () => {
    const logger = createMemoryLogger();
    const invalidKey = `0x${"0".repeat(64)}`;
    const exitCode = runOperator(
      { [OPERATOR_PRIVATE_KEY_ENV_VAR]: invalidKey },
      logger,
    );

    expect(exitCode).toBe(1);
    expect(logger.messages).toEqual([]);
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toContain(OPERATOR_PRIVATE_KEY_ENV_VAR);
    expect(logger.errors[0]).not.toContain(invalidKey);
    expect(logger.errors[0]).not.toContain("privateKeyToAddress");
  });

  test("sanitizes unexpected startup errors", () => {
    const logger = createMemoryLogger();
    const unexpectedSensitiveValue = "unexpected-sensitive-value";
    const throwingEnvironment = new Proxy<Record<string, string | undefined>>(
      {},
      {
        get: () => {
          throw new Error(unexpectedSensitiveValue);
        },
      },
    );

    const exitCode = runOperator(throwingEnvironment, logger);

    expect(exitCode).toBe(1);
    expect(logger.messages).toEqual([]);
    expect(logger.errors).toEqual([`${OPERATOR_NAME} failed to start`]);
    expect(logger.errors.join("\n")).not.toContain(unexpectedSensitiveValue);
  });
});
