import { getAddress, isAddress, type Address, zeroAddress } from "viem";
import { z } from "zod";

export const PLAYER_ADDRESS_ENV_VAR = "VEYDRIFT_PLAYER_ADDRESS" as const;

const playerAddressSchema = z
  .string()
  .refine((value) => isAddress(value), "invalid player address")
  .transform((value) => getAddress(value))
  .refine((value) => value !== zeroAddress, "invalid player address");

export interface PlayerIdentity {
  readonly playerAddress: Address;
}

export class PlayerIdentityConfigurationError extends Error {
  readonly code = "INVALID_PLAYER_ADDRESS" as const;
  readonly field = PLAYER_ADDRESS_ENV_VAR;

  constructor() {
    super(
      `${PLAYER_ADDRESS_ENV_VAR} must be a valid, nonzero 0x-prefixed EVM address`,
    );
    this.name = "PlayerIdentityConfigurationError";
  }
}

export function readPlayerIdentity(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<PlayerIdentity> {
  const result = playerAddressSchema.safeParse(
    environment[PLAYER_ADDRESS_ENV_VAR],
  );

  if (!result.success) {
    throw new PlayerIdentityConfigurationError();
  }

  return Object.freeze({ playerAddress: result.data });
}
