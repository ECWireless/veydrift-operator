import type { Address } from "viem";
import { getAddress, isAddress, zeroAddress } from "viem";
import { z } from "zod";

import {
  type PublicApiAdapter,
  type PublicApiReadResult,
  type PublicRpcAdapter,
  PublicReadTransportError,
} from "./public-read-adapters.ts";
import {
  isSnapshotSourceOverview,
  isSnapshotSourcePlanetDetail,
  isSnapshotSourceUniverseSystem,
  SnapshotNormalizationError,
  normalizeSnapshot,
} from "./snapshot-normalizer.ts";
import type { NormalizedSnapshot } from "./snapshot.ts";
import { SUPPORTED_DEPLOYMENT } from "./supported-deployment.ts";

const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/);
const abiHashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const isoTimestampSchema = z.string().refine((value) => {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
});
const canonicalDecimalSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
const hexQuantitySchema = z.string().regex(/^0x(?:0|[1-9a-f][0-9a-f]*)$/);
const hashSchema = z.string().regex(/^0x[0-9a-f]{64}$/);
const nonNegativeIntegerSchema = z.number().int().nonnegative().safe();
const evmAddressSchema = z
  .string()
  .refine((value) => isAddress(value))
  .transform((value) => getAddress(value));

const runtimeBootstrapSchema = z.object({
  apiUrl: z.string().url(),
  chainId: z.number().int().positive().safe(),
  contractAddress: evmAddressSchema,
  gameContractAddress: evmAddressSchema,
  network: z.string(),
  backend: z.object({
    build: z.object({
      deploymentAbiHash: abiHashSchema,
      deploymentCommit: gitCommitSchema,
      deploymentTimestamp: isoTimestampSchema,
      gitSha: gitCommitSchema,
      gitShaSource: z.string().trim().min(1),
    }),
  }),
});

const healthBootstrapSchema = z.object({
  ok: z.literal(true),
  configured: z.literal(true),
  service: z.string().trim().min(1),
  readiness: z.object({
    ready: z.literal(true),
    degraded: z.literal(false),
    degradationReasons: z.array(z.string()).max(0),
    configurationReady: z.literal(true),
  }),
});

const rpcFinalizedBlockSchema = z.object({
  number: hexQuantitySchema,
  hash: hashSchema,
  timestamp: hexQuantitySchema,
});

const overviewRoutingSchema = z.object({
  settlement: z.object({
    wallet: evmAddressSchema,
    hasFirstPlanet: z.boolean(),
    homePlanetId: canonicalDecimalSchema.nullable(),
    player: z.object({ wallet: evmAddressSchema }),
  }),
  planetsResponse: z.object({
    wallet: evmAddressSchema,
    homePlanetId: canonicalDecimalSchema.nullable(),
    player: z.object({ wallet: evmAddressSchema }).optional(),
    planets: z.array(
      z.object({
        planetId: canonicalDecimalSchema,
        owner: evmAddressSchema,
        galaxy: nonNegativeIntegerSchema,
        system: nonNegativeIntegerSchema,
        position: nonNegativeIntegerSchema,
        isHomePlanet: z.boolean(),
      }),
    ),
  }),
  queues: z.object({
    wallet: evmAddressSchema,
    homePlanetId: canonicalDecimalSchema.nullable(),
  }),
  fleetVisibility: z.object({
    wallet: evmAddressSchema,
    homePlanetId: canonicalDecimalSchema.nullable(),
  }),
});

const detailIdentitySchema = z.object({
  wallet: evmAddressSchema,
  homePlanetId: canonicalDecimalSchema,
  planetId: canonicalDecimalSchema.optional(),
  resourceSnapshot: z.object({ planetId: canonicalDecimalSchema }),
});

const systemIdentitySchema = z.object({
  galaxy: nonNegativeIntegerSchema,
  system: nonNegativeIntegerSchema,
  planets: z.array(
    z.object({
      position: nonNegativeIntegerSchema,
      occupiedBy: z
        .object({
          planetId: canonicalDecimalSchema,
          owner: evmAddressSchema,
        })
        .nullable(),
    }),
  ),
});

export type SnapshotCollectionErrorCode =
  | "API_REQUEST_FAILED"
  | "INVALID_OVERVIEW"
  | "INVALID_PLAYER_ADDRESS"
  | "INVALID_SOURCE_BATCH"
  | "PRIMARY_PLANET_INCONSISTENT"
  | "RPC_REQUEST_FAILED"
  | "UNSUPPORTED_BOOTSTRAP";

export class SnapshotCollectionError extends Error {
  readonly code: SnapshotCollectionErrorCode;
  readonly retryAfterSeconds?: number;
  readonly status?: number;
  readonly surface: string;

  constructor(
    code: SnapshotCollectionErrorCode,
    surface: string,
    options: {
      readonly retryAfterSeconds?: number;
      readonly status?: number;
    } = {},
  ) {
    super(`Snapshot collection failed at ${surface}`);
    this.name = "SnapshotCollectionError";
    this.code = code;
    this.surface = surface;
    if (options.status !== undefined) this.status = options.status;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export interface SnapshotCollectorOptions {
  readonly api: PublicApiAdapter;
  readonly clock?: () => Date;
  readonly highscorePageSize?: number;
  readonly rpc: PublicRpcAdapter;
}

interface RoutingPlanet {
  readonly galaxy: number;
  readonly isHomePlanet: boolean;
  readonly planetId: string;
  readonly position: number;
  readonly system: number;
}

interface PlanetDetails {
  readonly defenses: PublicApiReadResult;
  readonly infrastructure: PublicApiReadResult;
  readonly planetId: string;
  readonly research: PublicApiReadResult;
  readonly shipyard: PublicApiReadResult;
}

export class OneShotSnapshotCollector {
  readonly #api: PublicApiAdapter;
  readonly #clock: () => Date;
  readonly #highscorePageSize: number;
  readonly #rpc: PublicRpcAdapter;

  constructor(options: SnapshotCollectorOptions) {
    this.#api = options.api;
    this.#rpc = options.rpc;
    this.#clock = options.clock ?? (() => new Date());
    this.#highscorePageSize = options.highscorePageSize ?? 100;
    if (
      !Number.isSafeInteger(this.#highscorePageSize) ||
      this.#highscorePageSize < 1 ||
      this.#highscorePageSize > 100
    ) {
      throw new RangeError(
        "highscorePageSize must be an integer from 1 to 100",
      );
    }
  }

  async collect(
    playerAddressInput: Address | string,
  ): Promise<NormalizedSnapshot> {
    const playerAddress = normalizePlayerAddress(playerAddressInput);

    const runtimeResponse = await this.#readApi(
      "runtime-config",
      "/runtime-config",
    );
    const runtime = parseBootstrap(
      runtimeBootstrapSchema,
      runtimeResponse.body,
      "runtime-config",
    );
    validateRuntime(runtime);

    const healthResponse = await this.#readApi("health", "/health");
    parseBootstrap(healthBootstrapSchema, healthResponse.body, "health");

    const rpcChainId = await this.#readRpc("chain-id", () =>
      this.#rpc.getChainId(),
    );
    const parsedRpcChainId = parseBootstrap(
      hexQuantitySchema,
      rpcChainId,
      "chain-id",
    );
    if (
      Number(BigInt(parsedRpcChainId)) !== SUPPORTED_DEPLOYMENT.core.chain.id
    ) {
      throw new SnapshotCollectionError("UNSUPPORTED_BOOTSTRAP", "chain-id");
    }

    const finalizedBlock = parseBootstrap(
      rpcFinalizedBlockSchema,
      await this.#readRpc("finalized-block", () =>
        this.#rpc.getFinalizedBlock(),
      ),
      "finalized-block",
    );

    const walletPath = `/wallet/${encodeURIComponent(playerAddress)}`;
    const overviewResponse = await this.#readApi(
      "overview",
      `${walletPath}/overview`,
    );
    if (!isSnapshotSourceOverview(overviewResponse.body)) {
      throw new SnapshotCollectionError("INVALID_OVERVIEW", "overview");
    }
    const routing = overviewRoutingSchema.safeParse(overviewResponse.body);
    if (!routing.success) {
      throw new SnapshotCollectionError("INVALID_OVERVIEW", "overview");
    }
    validateOverviewIdentity(routing.data, playerAddress);

    const { primary, secondary } = resolvePlanetOrder(routing.data);
    const headersBySurface: Record<string, Readonly<Record<string, string>>> = {
      runtimeConfig: runtimeResponse.headers,
      health: healthResponse.headers,
      overview: overviewResponse.headers,
    };
    const infrastructureByPlanet: Record<string, unknown> = {};
    const shipyardByPlanet: Record<string, unknown> = {};
    const defensesByPlanet: Record<string, unknown> = {};
    const researchByPlanet: Record<string, unknown> = {};
    const systems: unknown[] = [];

    let primarySystemKey: string | null = null;
    if (primary !== null) {
      const [details, system] = await Promise.all([
        this.#collectPlanetDetails(
          walletPath,
          primary,
          playerAddress,
          primary.planetId,
        ),
        this.#collectSystem(primary, playerAddress),
      ]);
      recordPlanetDetails(
        details,
        headersBySurface,
        infrastructureByPlanet,
        shipyardByPlanet,
        defensesByPlanet,
        researchByPlanet,
      );
      recordSystem(system, headersBySurface, systems);
      primarySystemKey = coordinateKey(primary);
    }

    const secondarySystems = uniqueSystems(secondary).filter(
      (planet) => coordinateKey(planet) !== primarySystemKey,
    );
    const secondaryDetailReads =
      primary === null
        ? []
        : secondary.map((planet) =>
            this.#collectPlanetDetails(
              walletPath,
              planet,
              playerAddress,
              primary.planetId,
            ),
          );
    const [secondaryDetails, highscores, activeMissions, remainingSystems] =
      await Promise.all([
        Promise.all(secondaryDetailReads),
        this.#readApi("highscores", highscorePath(this.#highscorePageSize)),
        this.#readApi("activeMissions", "/missions?status=active&live=1"),
        Promise.all(
          secondarySystems.map((planet) =>
            this.#collectSystem(planet, playerAddress),
          ),
        ),
      ]);

    for (const details of secondaryDetails) {
      recordPlanetDetails(
        details,
        headersBySurface,
        infrastructureByPlanet,
        shipyardByPlanet,
        defensesByPlanet,
        researchByPlanet,
      );
    }
    headersBySurface.highscores = highscores.headers;
    headersBySurface.activeMissions = activeMissions.headers;
    for (const system of remainingSystems) {
      recordSystem(system, headersBySurface, systems);
    }

    const batch = {
      headersBySurface,
      runtimeConfig: runtimeResponse.body,
      health: healthResponse.body,
      rpc: {
        chainId: parsedRpcChainId,
        finalizedBlock,
      },
      overview: overviewResponse.body,
      infrastructureByPlanet,
      shipyardByPlanet,
      defensesByPlanet,
      researchByPlanet,
      highscores: highscores.body,
      activeMissions: activeMissions.body,
      systems,
    };

    const observedAt = this.#clock().toISOString();
    try {
      return normalizeSnapshot(batch, {
        observedAt,
        playerAddress,
        upstreamCommit: runtime.backend.build.gitSha,
      });
    } catch (error) {
      if (error instanceof SnapshotNormalizationError) {
        throw new SnapshotCollectionError("INVALID_SOURCE_BATCH", "normalizer");
      }
      throw error;
    }
  }

  async #collectPlanetDetails(
    walletPath: string,
    planet: RoutingPlanet,
    playerAddress: Address,
    homePlanetId: string,
  ): Promise<PlanetDetails> {
    const query = `planetId=${encodeURIComponent(planet.planetId)}`;
    const [infrastructure, shipyard, defenses, research] = await Promise.all([
      this.#readApi(
        `infrastructure:${planet.planetId}`,
        `${walletPath}/infrastructure?${query}`,
      ),
      this.#readApi(
        `shipyard:${planet.planetId}`,
        `${walletPath}/shipyard?${query}`,
      ),
      this.#readApi(
        `defenses:${planet.planetId}`,
        `${walletPath}/defenses?${query}`,
      ),
      this.#readApi(
        `research:${planet.planetId}`,
        `${walletPath}/research?${query}`,
      ),
    ]);
    for (const [surface, result] of [
      ["infrastructure", infrastructure],
      ["shipyard", shipyard],
      ["defenses", defenses],
      ["research", research],
    ] as const) {
      if (!isSnapshotSourcePlanetDetail(surface, result.body)) {
        throw new SnapshotCollectionError(
          "INVALID_SOURCE_BATCH",
          `${surface}:${planet.planetId}`,
        );
      }
      if (!isPlanetDetailAvailable(surface, result.body)) {
        throw new SnapshotCollectionError(
          "INVALID_SOURCE_BATCH",
          `${surface}:${planet.planetId}`,
        );
      }
      const identity = detailIdentitySchema.safeParse(result.body);
      if (
        !identity.success ||
        identity.data.wallet !== playerAddress ||
        identity.data.homePlanetId !== homePlanetId ||
        identity.data.resourceSnapshot.planetId !== planet.planetId ||
        (identity.data.planetId !== undefined &&
          identity.data.planetId !== planet.planetId)
      ) {
        throw new SnapshotCollectionError(
          "INVALID_SOURCE_BATCH",
          `${surface}:${planet.planetId}`,
        );
      }
    }
    return {
      planetId: planet.planetId,
      infrastructure,
      shipyard,
      defenses,
      research,
    };
  }

  async #collectSystem(planet: RoutingPlanet, playerAddress: Address) {
    const key = coordinateKey(planet);
    const result = await this.#readApi(
      `universeSystem:${key}`,
      `/universe/galaxies/${planet.galaxy}/systems/${planet.system}?detail=full`,
    );
    if (!isSnapshotSourceUniverseSystem(result.body)) {
      throw new SnapshotCollectionError(
        "INVALID_SOURCE_BATCH",
        `universeSystem:${key}`,
      );
    }
    const identity = systemIdentitySchema.safeParse(result.body);
    if (
      !identity.success ||
      identity.data.galaxy !== planet.galaxy ||
      identity.data.system !== planet.system
    ) {
      throw new SnapshotCollectionError(
        "INVALID_SOURCE_BATCH",
        `universeSystem:${key}`,
      );
    }
    const occupiedPosition = identity.data.planets.filter(
      (candidate) => candidate.position === planet.position,
    );
    if (
      occupiedPosition.length !== 1 ||
      occupiedPosition[0]?.occupiedBy?.planetId !== planet.planetId ||
      occupiedPosition[0]?.occupiedBy?.owner !== playerAddress
    ) {
      throw new SnapshotCollectionError(
        "INVALID_SOURCE_BATCH",
        `universeSystem:${key}`,
      );
    }
    return { key, result };
  }

  async #readApi(surface: string, path: string): Promise<PublicApiReadResult> {
    try {
      return await this.#api.get(path);
    } catch (error) {
      if (error instanceof PublicReadTransportError) {
        throw new SnapshotCollectionError("API_REQUEST_FAILED", surface, {
          ...(error.status === undefined ? {} : { status: error.status }),
          ...(error.retryAfterSeconds === undefined
            ? {}
            : { retryAfterSeconds: error.retryAfterSeconds }),
        });
      }
      if (error instanceof SnapshotCollectionError) throw error;
      throw new SnapshotCollectionError("API_REQUEST_FAILED", surface);
    }
  }

  async #readRpc(
    surface: string,
    read: () => Promise<unknown>,
  ): Promise<unknown> {
    try {
      return await read();
    } catch (error) {
      if (error instanceof PublicReadTransportError) {
        throw new SnapshotCollectionError("RPC_REQUEST_FAILED", surface, {
          ...(error.status === undefined ? {} : { status: error.status }),
        });
      }
      if (error instanceof SnapshotCollectionError) throw error;
      throw new SnapshotCollectionError("RPC_REQUEST_FAILED", surface);
    }
  }
}

function normalizePlayerAddress(value: Address | string): Address {
  if (!isAddress(value)) {
    throw new SnapshotCollectionError(
      "INVALID_PLAYER_ADDRESS",
      "player-address",
    );
  }
  const address = getAddress(value);
  if (address === zeroAddress) {
    throw new SnapshotCollectionError(
      "INVALID_PLAYER_ADDRESS",
      "player-address",
    );
  }
  return address;
}

function parseBootstrap<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  surface: string,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new SnapshotCollectionError("UNSUPPORTED_BOOTSTRAP", surface);
  }
  return result.data;
}

function validateRuntime(
  runtime: z.output<typeof runtimeBootstrapSchema>,
): void {
  const supported = SUPPORTED_DEPLOYMENT.core;
  if (
    runtime.apiUrl !== supported.surfaces.apiUrl ||
    runtime.chainId !== supported.chain.id ||
    runtime.contractAddress !== supported.game.proxy.address ||
    runtime.gameContractAddress !== supported.game.proxy.address ||
    runtime.network !== supported.chain.name ||
    runtime.backend.build.deploymentCommit !== supported.deployment.commit ||
    runtime.backend.build.deploymentAbiHash !==
      supported.deployment.abiSha256 ||
    runtime.backend.build.deploymentTimestamp !== supported.deployment.timestamp
  ) {
    throw new SnapshotCollectionError(
      "UNSUPPORTED_BOOTSTRAP",
      "runtime-config",
    );
  }
}

function validateOverviewIdentity(
  overview: z.output<typeof overviewRoutingSchema>,
  playerAddress: Address,
): void {
  const wallets = [
    overview.settlement.wallet,
    overview.settlement.player.wallet,
    overview.planetsResponse.wallet,
    overview.queues.wallet,
    overview.fleetVisibility.wallet,
    ...overview.planetsResponse.planets.map((planet) => planet.owner),
  ];
  if (overview.planetsResponse.player !== undefined) {
    wallets.push(overview.planetsResponse.player.wallet);
  }
  if (wallets.some((wallet) => wallet !== playerAddress)) {
    throw new SnapshotCollectionError("INVALID_OVERVIEW", "overview");
  }

  const homePlanetIds = [
    overview.settlement.homePlanetId,
    overview.planetsResponse.homePlanetId,
    overview.queues.homePlanetId,
    overview.fleetVisibility.homePlanetId,
  ];
  if (new Set(homePlanetIds).size !== 1) {
    throw new SnapshotCollectionError(
      "PRIMARY_PLANET_INCONSISTENT",
      "overview",
    );
  }
}

function isPlanetDetailAvailable(
  surface: "defenses" | "infrastructure" | "research" | "shipyard",
  input: unknown,
): boolean {
  if (typeof input !== "object" || input === null) return false;
  const detail = input as Readonly<Record<string, unknown>>;
  switch (surface) {
    case "infrastructure":
      return detail.infrastructureAvailable === true;
    case "research":
      return detail.researchAvailable === true;
    case "defenses":
    case "shipyard":
      return detail.productionAvailable === true;
  }
}

function resolvePlanetOrder(input: z.output<typeof overviewRoutingSchema>): {
  readonly primary: RoutingPlanet | null;
  readonly secondary: readonly RoutingPlanet[];
} {
  const planets = input.planetsResponse.planets;
  const ids = planets.map((planet) => planet.planetId);
  if (new Set(ids).size !== ids.length) {
    throw new SnapshotCollectionError(
      "PRIMARY_PLANET_INCONSISTENT",
      "overview",
    );
  }

  const { hasFirstPlanet, homePlanetId } = input.settlement;
  if (!hasFirstPlanet) {
    if (homePlanetId !== null || planets.length > 0) {
      throw new SnapshotCollectionError(
        "PRIMARY_PLANET_INCONSISTENT",
        "overview",
      );
    }
    return { primary: null, secondary: [] };
  }

  if (homePlanetId === null) {
    throw new SnapshotCollectionError(
      "PRIMARY_PLANET_INCONSISTENT",
      "overview",
    );
  }
  const primary = planets.find((planet) => planet.planetId === homePlanetId);
  if (
    primary === undefined ||
    !primary.isHomePlanet ||
    planets.some(
      (planet) => planet.planetId !== homePlanetId && planet.isHomePlanet,
    )
  ) {
    throw new SnapshotCollectionError(
      "PRIMARY_PLANET_INCONSISTENT",
      "overview",
    );
  }

  return {
    primary,
    secondary: planets.filter((planet) => planet.planetId !== homePlanetId),
  };
}

function highscorePath(pageSize: number): string {
  return `/highscores?category=total&live=1&page=1&pageSize=${pageSize}`;
}

function coordinateKey(planet: RoutingPlanet): string {
  return `${planet.galaxy}:${planet.system}`;
}

function uniqueSystems(planets: readonly RoutingPlanet[]): RoutingPlanet[] {
  const systems = new Map<string, RoutingPlanet>();
  for (const planet of planets) {
    const key = coordinateKey(planet);
    if (!systems.has(key)) systems.set(key, planet);
  }
  return [...systems.values()];
}

function recordPlanetDetails(
  details: PlanetDetails,
  headers: Record<string, Readonly<Record<string, string>>>,
  infrastructure: Record<string, unknown>,
  shipyard: Record<string, unknown>,
  defenses: Record<string, unknown>,
  research: Record<string, unknown>,
): void {
  const id = details.planetId;
  infrastructure[id] = details.infrastructure.body;
  shipyard[id] = details.shipyard.body;
  defenses[id] = details.defenses.body;
  research[id] = details.research.body;
  headers[`infrastructure:${id}`] = details.infrastructure.headers;
  headers[`shipyard:${id}`] = details.shipyard.headers;
  headers[`defenses:${id}`] = details.defenses.headers;
  headers[`research:${id}`] = details.research.headers;
}

function recordSystem(
  system: {
    readonly key: string;
    readonly result: PublicApiReadResult;
  },
  headers: Record<string, Readonly<Record<string, string>>>,
  systems: unknown[],
): void {
  systems.push(system.result.body);
  headers[`universeSystem:${system.key}`] = system.result.headers;
}
