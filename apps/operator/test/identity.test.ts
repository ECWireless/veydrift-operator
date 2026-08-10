import { describe, expect, test } from "bun:test";

import {
  PLAYER_ADDRESS_ENV_VAR,
  PlayerIdentityConfigurationError,
  readPlayerIdentity,
} from "../src/identity.ts";

const SYNTHETIC_WALLET_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const LOWERCASE_WALLET_ADDRESS = SYNTHETIC_WALLET_ADDRESS.toLowerCase();

function expectConfigurationError(
  environment: Readonly<Record<string, string | undefined>>,
): PlayerIdentityConfigurationError {
  try {
    readPlayerIdentity(environment);
  } catch (error) {
    expect(error).toBeInstanceOf(PlayerIdentityConfigurationError);
    return error as PlayerIdentityConfigurationError;
  }

  throw new Error("Expected player identity configuration to fail");
}

describe("player identity", () => {
  test("reads a frozen public identity from a checksummed player address", () => {
    const identity = readPlayerIdentity({
      [PLAYER_ADDRESS_ENV_VAR]: SYNTHETIC_WALLET_ADDRESS,
    });

    expect(identity).toEqual({ playerAddress: SYNTHETIC_WALLET_ADDRESS });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Object.keys(identity)).toEqual(["playerAddress"]);
  });

  test("normalizes a lowercase player address to its checksum", () => {
    const identity = readPlayerIdentity({
      [PLAYER_ADDRESS_ENV_VAR]: LOWERCASE_WALLET_ADDRESS,
    });

    expect(identity).toEqual({ playerAddress: SYNTHETIC_WALLET_ADDRESS });
  });

  test("does not read the legacy private-key setting", () => {
    const environment = new Proxy(
      { [PLAYER_ADDRESS_ENV_VAR]: SYNTHETIC_WALLET_ADDRESS },
      {
        get: (target, property, receiver) => {
          if (property === "VEYDRIFT_OPERATOR_PRIVATE_KEY") {
            throw new Error("legacy private key was read");
          }

          return Reflect.get(target, property, receiver);
        },
      },
    );

    expect(readPlayerIdentity(environment)).toEqual({
      playerAddress: SYNTHETIC_WALLET_ADDRESS,
    });
  });

  test("rejects a missing player address", () => {
    const error = expectConfigurationError({});

    expect(error.code).toBe("INVALID_PLAYER_ADDRESS");
    expect(error.field).toBe(PLAYER_ADDRESS_ENV_VAR);
    expect(error.message).toContain(PLAYER_ADDRESS_ENV_VAR);
    expect(error).not.toHaveProperty("cause");
  });

  test.each([
    "",
    "0x1",
    `0x${"g".repeat(40)}`,
    `0x${"0".repeat(40)}`,
    "0x7E5F4552091A69125d5DfCb7b8C2659029395BDF",
    `${LOWERCASE_WALLET_ADDRESS}00`,
  ])("rejects an invalid player address without echoing it", (candidate) => {
    const error = expectConfigurationError({
      [PLAYER_ADDRESS_ENV_VAR]: candidate,
    });

    if (candidate.length > 0) {
      expect(error.message).not.toContain(candidate);
      expect(JSON.stringify(error)).not.toContain(candidate);
    }
  });
});
