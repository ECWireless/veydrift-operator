import { describe, expect, test } from "bun:test";

import {
  deriveOperatorIdentity,
  OPERATOR_PRIVATE_KEY_ENV_VAR,
  OperatorIdentityConfigurationError,
} from "../src/identity.ts";

const SYNTHETIC_PRIVATE_KEY = `0x${"1".padStart(64, "0")}`;
const SYNTHETIC_WALLET_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const SECP256K1_ORDER_PREFIX = `${"f".repeat(31)}ebaaedce6af48a03bbfd25e8cd036`;
const GREATEST_VALID_PRIVATE_KEY = `0x${SECP256K1_ORDER_PREFIX}4140`;
const GREATEST_VALID_WALLET_ADDRESS =
  "0x80C0dbf239224071c59dD8970ab9d542E3414aB2";
const SECP256K1_ORDER = `0x${SECP256K1_ORDER_PREFIX}4141`;

function expectConfigurationError(
  environment: Readonly<Record<string, string | undefined>>,
): OperatorIdentityConfigurationError {
  try {
    deriveOperatorIdentity(environment);
  } catch (error) {
    expect(error).toBeInstanceOf(OperatorIdentityConfigurationError);
    return error as OperatorIdentityConfigurationError;
  }

  throw new Error("Expected operator identity derivation to fail");
}

describe("operator identity", () => {
  test("derives a frozen public identity from a synthetic private key", () => {
    const identity = deriveOperatorIdentity({
      [OPERATOR_PRIVATE_KEY_ENV_VAR]: SYNTHETIC_PRIVATE_KEY,
    });

    expect(identity).toEqual({ walletAddress: SYNTHETIC_WALLET_ADDRESS });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(Object.keys(identity)).toEqual(["walletAddress"]);
    expect(JSON.stringify(identity)).not.toContain(SYNTHETIC_PRIVATE_KEY);
  });

  test("rejects a missing private key without exposing input", () => {
    const error = expectConfigurationError({});

    expect(error.code).toBe("INVALID_OPERATOR_PRIVATE_KEY");
    expect(error.field).toBe(OPERATOR_PRIVATE_KEY_ENV_VAR);
    expect(error.message).toContain(OPERATOR_PRIVATE_KEY_ENV_VAR);
    expect(error).not.toHaveProperty("cause");
  });

  test("accepts the greatest valid secp256k1 scalar", () => {
    const identity = deriveOperatorIdentity({
      [OPERATOR_PRIVATE_KEY_ENV_VAR]: GREATEST_VALID_PRIVATE_KEY,
    });

    expect(identity).toEqual({
      walletAddress: GREATEST_VALID_WALLET_ADDRESS,
    });
  });

  test.each([
    "",
    "1".repeat(64),
    "0x1",
    `0x${"g".repeat(64)}`,
    `0x${"0".repeat(64)}`,
    SECP256K1_ORDER,
    `0x${"f".repeat(64)}`,
  ])("rejects an invalid key without echoing it", (candidate) => {
    const error = expectConfigurationError({
      [OPERATOR_PRIVATE_KEY_ENV_VAR]: candidate,
    });

    if (candidate.length > 0) {
      expect(error.message).not.toContain(candidate);
      expect(JSON.stringify(error)).not.toContain(candidate);
    }
  });
});
