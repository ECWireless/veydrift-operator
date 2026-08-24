import { describe, expect, test } from "bun:test";

import {
  createStartupMessage,
  OPERATOR_NAME,
  type OperatorLogger,
  type OperatorRuntimeController,
  type OperatorRuntimeFactory,
  startOperator,
} from "../src/index.ts";
import { PLAYER_ADDRESS_ENV_VAR } from "../src/identity.ts";

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
  test("starts the injected runtime and reports its loopback URL", () => {
    const logger = createMemoryLogger();
    const { factory, runtime } = createRuntimeFactory();
    const result = startOperator(
      { [PLAYER_ADDRESS_ENV_VAR]: SYNTHETIC_WALLET_ADDRESS },
      logger,
      factory,
    );

    expect(result).toEqual({ exitCode: 0, runtime });
    expect(runtime.startCalls).toBe(1);
    expect(logger.errors).toEqual([]);
    expect(logger.messages).toEqual([
      createStartupMessage(
        { playerAddress: SYNTHETIC_WALLET_ADDRESS },
        "http://127.0.0.1:3000",
      ),
    ]);
    expect(logger.messages.join("\n")).toContain(SYNTHETIC_WALLET_ADDRESS);
  });

  test("fails closed with a sanitized configuration error", () => {
    const logger = createMemoryLogger();
    const invalidAddress = `0x${"0".repeat(40)}`;
    const result = startOperator(
      { [PLAYER_ADDRESS_ENV_VAR]: invalidAddress },
      logger,
      createRuntimeFactory().factory,
    );

    expect(result).toEqual({ exitCode: 1, runtime: null });
    expect(logger.messages).toEqual([]);
    expect(logger.errors).toHaveLength(1);
    expect(logger.errors[0]).toContain(PLAYER_ADDRESS_ENV_VAR);
    expect(logger.errors[0]).not.toContain(invalidAddress);
    expect(logger.errors[0]).not.toContain("getAddress");
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

    const result = startOperator(
      throwingEnvironment,
      logger,
      createRuntimeFactory().factory,
    );

    expect(result).toEqual({ exitCode: 1, runtime: null });
    expect(logger.messages).toEqual([]);
    expect(logger.errors).toEqual([`${OPERATOR_NAME} failed to start`]);
    expect(logger.errors.join("\n")).not.toContain(unexpectedSensitiveValue);
  });

  test("sanitizes an unexpected runtime startup failure", () => {
    const logger = createMemoryLogger();
    const sensitiveValue = "sensitive-runtime-detail";
    const result = startOperator(
      { [PLAYER_ADDRESS_ENV_VAR]: SYNTHETIC_WALLET_ADDRESS },
      logger,
      () => {
        throw new Error(sensitiveValue);
      },
    );

    expect(result).toEqual({ exitCode: 1, runtime: null });
    expect(logger.errors).toEqual([`${OPERATOR_NAME} failed to start`]);
    expect(logger.errors.join("\n")).not.toContain(sensitiveValue);
  });

  test("cleans up a runtime that does not expose a bound URL", () => {
    const logger = createMemoryLogger();
    const { factory, runtime } = createRuntimeFactory();
    runtime.url = null;

    const result = startOperator(
      { [PLAYER_ADDRESS_ENV_VAR]: SYNTHETIC_WALLET_ADDRESS },
      logger,
      factory,
    );

    expect(result).toEqual({ exitCode: 1, runtime: null });
    expect(runtime.startCalls).toBe(1);
    expect(runtime.stopCalls).toBe(1);
    expect(logger.errors).toEqual([`${OPERATOR_NAME} failed to start`]);
  });
});

function createRuntimeFactory(): {
  factory: OperatorRuntimeFactory;
  runtime: OperatorRuntimeController & {
    url: string | null;
    startCalls: number;
    stopCalls: number;
  };
} {
  const runtime = {
    url: "http://127.0.0.1:3000",
    startCalls: 0,
    stopCalls: 0,
    start() {
      this.startCalls += 1;
    },
    async stop() {
      this.stopCalls += 1;
    },
  };

  return { factory: () => runtime, runtime };
}
