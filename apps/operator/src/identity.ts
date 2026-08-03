import type { Address, Hex } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import { z } from "zod";

export const OPERATOR_PRIVATE_KEY_ENV_VAR =
  "VEYDRIFT_OPERATOR_PRIVATE_KEY" as const;

const privateKeySchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "invalid private key format");

export interface OperatorIdentity {
  readonly walletAddress: Address;
}

export class OperatorIdentityConfigurationError extends Error {
  readonly code = "INVALID_OPERATOR_PRIVATE_KEY" as const;
  readonly field = OPERATOR_PRIVATE_KEY_ENV_VAR;

  constructor() {
    super(
      `${OPERATOR_PRIVATE_KEY_ENV_VAR} must be a valid 0x-prefixed, 32-byte secp256k1 private key`,
    );
    this.name = "OperatorIdentityConfigurationError";
  }
}

export function deriveOperatorIdentity(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<OperatorIdentity> {
  const result = privateKeySchema.safeParse(
    environment[OPERATOR_PRIVATE_KEY_ENV_VAR],
  );

  if (!result.success) {
    throw new OperatorIdentityConfigurationError();
  }

  try {
    const walletAddress = privateKeyToAddress(result.data as Hex);
    return Object.freeze({ walletAddress });
  } catch {
    throw new OperatorIdentityConfigurationError();
  }
}
