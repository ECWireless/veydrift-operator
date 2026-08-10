import type { Address } from "viem";
import { zeroAddress } from "viem";
import { z } from "zod";

import {
  canonicalDecimalSchema,
  defensesSchema,
  evmAddressSchema,
  fleetVisibilitySchema,
  hashSchema,
  highscoreEntrySchema,
  infrastructureSchema,
  isoTimestampSchema,
  missionSchema,
  type NormalizedSnapshot,
  parseNormalizedSnapshot,
  planetSchema,
  playerProfileSchema,
  queueSchema,
  researchSchema,
  type resourceSnapshotSchema,
  resourcesSchema,
  shipyardSchema,
  type SnapshotAvailabilityIssue,
  sourceIndexStateSchema,
  universeSystemSchema,
} from "./snapshot.ts";
import { SUPPORTED_DEPLOYMENT } from "./supported-deployment.ts";

const nonNegativeIntegerSchema = z.number().int().nonnegative().safe();
const hexQuantitySchema = z
  .string()
  .regex(/^0x(?:0|[1-9a-f][0-9a-f]*)$/, "must be a lowercase hex quantity");

const sourceResourceSnapshotSchema = z.object({
  planetId: canonicalDecimalSchema,
  transactionHash: hashSchema,
  blockNumber: canonicalDecimalSchema,
  logIndex: canonicalDecimalSchema,
  lastSettledAt: canonicalDecimalSchema,
  resources: resourcesSchema.optional(),
});

const sourceQueueSchema = z.object(queueSchema.shape);
const sourceProfileSchema = z.object(playerProfileSchema.shape);

const sourcePlanetSchema = z.object({
  planetId: canonicalDecimalSchema,
  owner: evmAddressSchema,
  name: z.string(),
  bodyKind: z.string().trim().min(1),
  galaxy: nonNegativeIntegerSchema,
  system: nonNegativeIntegerSchema,
  position: nonNegativeIntegerSchema,
  coordinates: z.string().trim().min(1),
  fields: nonNegativeIntegerSchema,
  fieldsUsed: nonNegativeIntegerSchema,
  fieldsCapacity: nonNegativeIntegerSchema,
  temperature: z.number().int().safe(),
  metalMultiplierBps: nonNegativeIntegerSchema,
  crystalMultiplierBps: nonNegativeIntegerSchema,
  deuteriumMultiplierBps: nonNegativeIntegerSchema,
  isHomePlanet: z.boolean(),
  lastSettledAt: canonicalDecimalSchema,
  blockNumber: canonicalDecimalSchema,
  logIndex: canonicalDecimalSchema,
  transactionHash: hashSchema,
  resources: resourcesSchema,
  resourcesAsOfNow: resourcesSchema,
  resourceSnapshot: sourceResourceSnapshotSchema,
  keyLevels: z.record(z.string().trim().min(1), nonNegativeIntegerSchema),
  queues: z.object({
    building: sourceQueueSchema.nullable(),
    defense: sourceQueueSchema.nullable(),
    ship: sourceQueueSchema.nullable(),
  }),
  moon: z.unknown().nullable(),
  tactical: z.object({
    currentResources: resourcesSchema,
    raidableResources: resourcesSchema,
    raidableResourceTotal: canonicalDecimalSchema,
    grossResourceTotal: canonicalDecimalSchema,
    productionPerHour: resourcesSchema,
    storageCaps: resourcesSchema,
    ships: z.object({
      count: nonNegativeIntegerSchema,
      power: canonicalDecimalSchema,
    }),
    defenses: z.object({
      count: nonNegativeIntegerSchema,
      power: canonicalDecimalSchema,
    }),
    combatPower: canonicalDecimalSchema,
  }),
});

const sourceInfrastructureSchema = z.object(infrastructureSchema.shape);
const sourceShipyardSchema = z.object(shipyardSchema.shape);
const sourceDefensesSchema = z.object(defensesSchema.shape);
const sourceResearchSchema = z.object(researchSchema.shape);

const sourceMissionSchema = z.object(missionSchema.shape);

const sourceFleetVisibilitySchema = z.object({
  wallet: evmAddressSchema,
  homePlanetId: canonicalDecimalSchema,
  indexedRevision: z.string().trim().min(1),
  indexedBlock: canonicalDecimalSchema,
  generatedAt: isoTimestampSchema,
  incoming: z.array(sourceMissionSchema),
  outgoing: z.array(sourceMissionSchema),
  returning: z.array(sourceMissionSchema),
  joinableAttacks: z.array(z.unknown()),
  completedMissions: z.array(z.unknown()),
  battleReports: z.array(z.unknown()),
});

const sourceHighscoreEntrySchema = z.object({
  rank: z.number().int().positive().safe(),
  wallet: evmAddressSchema,
  displayName: z.string().nullable(),
  homePlanetId: canonicalDecimalSchema.nullable(),
  homePlanet: z.unknown().nullable(),
  planetCount: nonNegativeIntegerSchema,
  score: z.object(highscoreEntrySchema.shape.score.shape),
  totalUserScore: canonicalDecimalSchema,
});

const sourceUniverseSystemSchema = z.object({
  galaxy: nonNegativeIntegerSchema,
  system: nonNegativeIntegerSchema,
  planets: z.array(
    z.object({
      galaxy: nonNegativeIntegerSchema,
      system: nonNegativeIntegerSchema,
      position: nonNegativeIntegerSchema,
      key: z.string().trim().min(1),
      fields: nonNegativeIntegerSchema,
      temperature: z.number().int().safe(),
      metalMultiplierBps: nonNegativeIntegerSchema,
      crystalMultiplierBps: nonNegativeIntegerSchema,
      deuteriumMultiplierBps: nonNegativeIntegerSchema,
      archetype: z.string(),
      name: z.string(),
      occupiedBy: z
        .object({
          planetId: canonicalDecimalSchema,
          owner: evmAddressSchema,
          ownerDisplayName: z.string().nullable(),
          alliance: z.string().nullable(),
        })
        .nullable(),
      hasMoon: z.boolean(),
      debrisField: z.unknown().nullable(),
      publicState: z
        .object({
          resources: resourcesSchema,
          buildings: z.array(
            z.object({
              id: nonNegativeIntegerSchema,
              level: nonNegativeIntegerSchema,
            }),
          ),
          fleet: z.array(
            z.object({
              id: nonNegativeIntegerSchema,
              count: nonNegativeIntegerSchema,
            }),
          ),
          defenses: z.array(
            z.object({
              id: nonNegativeIntegerSchema,
              count: nonNegativeIntegerSchema,
            }),
          ),
        })
        .nullable(),
    }),
  ),
});

const sourceBatchSchema = z.object({
  headersBySurface: z.record(
    z.string().trim().min(1),
    z.record(z.string().trim().min(1), z.string().trim().min(1)),
  ),
  runtimeConfig: z.object({
    apiUrl: z.string().url(),
    chainId: z.number().int().positive().safe(),
    contractAddress: evmAddressSchema,
    gameContractAddress: evmAddressSchema,
    network: z.string().trim().min(1),
    backend: z
      .object({
        build: z.object({
          deploymentAbiHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
          deploymentCommit: z.string().regex(/^[0-9a-f]{40}$/),
          deploymentTimestamp: isoTimestampSchema,
          gitSha: z.string().regex(/^[0-9a-f]{40}$/),
          gitShaSource: z.string().trim().min(1),
        }),
      })
      .optional(),
  }),
  health: z.object({
    ok: z.boolean(),
    configured: z.boolean(),
    service: z.string().trim().min(1),
    readiness: z.object({
      ready: z.boolean(),
      degraded: z.boolean(),
      degradationReasons: z.array(z.string()),
      configurationReady: z.boolean(),
    }),
  }),
  rpc: z.object({
    chainId: hexQuantitySchema,
    finalizedBlock: z.object({
      number: hexQuantitySchema,
      hash: hashSchema,
      timestamp: hexQuantitySchema,
    }),
  }),
  overview: z.object({
    source: z.string().trim().min(1),
    stale: z.boolean(),
    detail: z.string().nullable().optional(),
    indexer: z.object({
      indexedState: sourceIndexStateSchema,
      safeToServeIndexedState: z.boolean(),
      latestIndexedBlock: canonicalDecimalSchema,
      lastRebuiltAt: isoTimestampSchema.nullable(),
      lastReconciledAt: isoTimestampSchema.nullable(),
      staleReason: z.string().nullable().optional(),
    }),
    settlement: z.object({
      wallet: evmAddressSchema,
      hasFirstPlanet: z.boolean(),
      homePlanetId: canonicalDecimalSchema.nullable(),
      player: sourceProfileSchema,
      planet: z.unknown().nullable(),
    }),
    planetsResponse: z.object({
      wallet: evmAddressSchema,
      homePlanetId: canonicalDecimalSchema.nullable(),
      player: sourceProfileSchema.optional(),
      queues: z
        .object({
          research: sourceQueueSchema.nullable(),
        })
        .optional(),
      planets: z.array(sourcePlanetSchema),
    }),
    queues: z.object({
      wallet: evmAddressSchema,
      homePlanetId: canonicalDecimalSchema.nullable(),
      building: sourceQueueSchema.nullable(),
      defense: sourceQueueSchema.nullable(),
      ship: sourceQueueSchema.nullable(),
      research: sourceQueueSchema.nullable(),
    }),
    fleetVisibility: sourceFleetVisibilitySchema,
  }),
  infrastructureByPlanet: z.record(
    canonicalDecimalSchema,
    sourceInfrastructureSchema,
  ),
  shipyardByPlanet: z.record(canonicalDecimalSchema, sourceShipyardSchema),
  defensesByPlanet: z.record(canonicalDecimalSchema, sourceDefensesSchema),
  researchByPlanet: z.record(canonicalDecimalSchema, sourceResearchSchema),
  highscores: z.object({
    generatedAt: isoTimestampSchema,
    source: z.string().trim().min(1),
    formula: z.object({
      pointsDivisor: canonicalDecimalSchema,
      summary: z.string(),
      target: z.literal("totalUserScore"),
      excludedCategories: z.array(z.string()),
    }),
    pagination: z.object({
      page: z.number().int().positive().safe(),
      pageSize: z.number().int().positive().safe(),
      totalEntries: nonNegativeIntegerSchema,
      totalPages: nonNegativeIntegerSchema,
      hasPreviousPage: z.boolean(),
      hasNextPage: z.boolean(),
    }),
    rankings: z.object({
      total: z.array(sourceHighscoreEntrySchema),
    }),
  }),
  activeMissions: z.object({
    missions: z.array(sourceMissionSchema),
  }),
  systems: z.array(sourceUniverseSystemSchema),
  failures: z
    .array(
      z.object({
        surface: z.string().trim().min(1),
        planetId: canonicalDecimalSchema.optional(),
        kind: z.string().trim().min(1),
        status: z.number().int().positive().safe().optional(),
        retryable: z.boolean(),
        code: z.string().trim().min(1),
      }),
    )
    .optional()
    .default([]),
});

export interface SnapshotObservation {
  readonly observedAt: string;
  readonly playerAddress: Address | string;
  readonly upstreamCommit: string;
}

export class SnapshotNormalizationError extends Error {
  readonly code:
    | "INCONSISTENT_SOURCE_BATCH"
    | "INVALID_OBSERVATION"
    | "INVALID_SOURCE_BATCH"
    | "UNSUPPORTED_DEPLOYMENT";

  constructor(code: SnapshotNormalizationError["code"], message: string) {
    super(message);
    this.name = "SnapshotNormalizationError";
    this.code = code;
  }
}

const observationSchema = z.strictObject({
  observedAt: isoTimestampSchema,
  playerAddress: evmAddressSchema.refine(
    (address) => address !== zeroAddress,
    "must not be the zero address",
  ),
  upstreamCommit: z
    .string()
    .regex(/^[0-9a-f]{40}$/, "must be a lowercase, full Git commit SHA"),
});

export function normalizeSnapshot(
  input: unknown,
  observation: SnapshotObservation,
): NormalizedSnapshot {
  const parsedObservation = observationSchema.safeParse(observation);
  if (!parsedObservation.success) {
    throw new SnapshotNormalizationError(
      "INVALID_OBSERVATION",
      "Snapshot observation metadata is invalid",
    );
  }

  const parsedBatch = sourceBatchSchema.safeParse(input);
  if (!parsedBatch.success) {
    throw new SnapshotNormalizationError(
      "INVALID_SOURCE_BATCH",
      "Snapshot source batch is malformed",
    );
  }

  const batch = parsedBatch.data;
  const playerAddress = parsedObservation.data.playerAddress;
  validateDeployment(batch);
  validatePlayerConsistency(batch, playerAddress);

  const unavailable: SnapshotAvailabilityIssue[] = batch.failures.map(
    (failure) => ({
      surface: failure.surface,
      ...(failure.planetId === undefined ? {} : { planetId: failure.planetId }),
      reason: failure.code,
      retryable: failure.retryable,
      kind: failure.kind,
      ...(failure.status === undefined ? {} : { status: failure.status }),
    }),
  );

  if (
    !batch.health.ok ||
    !batch.health.configured ||
    !batch.health.readiness.ready ||
    batch.health.readiness.degraded ||
    !batch.health.readiness.configurationReady
  ) {
    unavailable.push({
      surface: "service-health",
      reason:
        batch.health.readiness.degradationReasons[0] ??
        (batch.health.readiness.ready
          ? "service_degraded"
          : "service_not_ready"),
      retryable: true,
    });
  }

  if (batch.runtimeConfig.backend === undefined) {
    unavailable.push({
      surface: "runtime-build",
      reason: "deployment_identity_unavailable",
      retryable: true,
    });
  }

  if (batch.overview.stale) {
    unavailable.push({
      surface: "overview",
      reason:
        batch.overview.detail ??
        batch.overview.indexer.staleReason ??
        "indexed_state_stale",
      retryable: true,
    });
  } else if (
    batch.overview.indexer.indexedState !== "healthy" ||
    !batch.overview.indexer.safeToServeIndexedState
  ) {
    unavailable.push({
      surface: "overview",
      reason: `indexed_state_${batch.overview.indexer.indexedState}`,
      retryable: true,
    });
  }

  if (
    batch.overview.settlement.hasFirstPlanet &&
    batch.overview.planetsResponse.planets.length === 0
  ) {
    unavailable.push({
      surface: "planets",
      reason: "managed_planets_unavailable",
      retryable: true,
    });
  }

  const score =
    batch.highscores.rankings.total.find(
      (entry) => entry.wallet === playerAddress,
    ) ?? null;
  if (score === null) {
    unavailable.push({
      surface: "player-score",
      reason: "ranking_entry_unavailable",
      retryable: true,
    });
  }

  for (const [surface, values] of [
    ["fleet-joinable-attacks", batch.overview.fleetVisibility.joinableAttacks],
    [
      "fleet-completed-missions",
      batch.overview.fleetVisibility.completedMissions,
    ],
    ["fleet-battle-reports", batch.overview.fleetVisibility.battleReports],
  ] as const) {
    if (values.length > 0) {
      unavailable.push({
        surface,
        reason: "unmodeled_source_data",
        retryable: false,
      });
    }
  }

  const planets = batch.overview.planetsResponse.planets.map((planet) => {
    const planetId = planet.planetId;
    const infrastructure = batch.infrastructureByPlanet[planetId] ?? null;
    const shipyard = batch.shipyardByPlanet[planetId] ?? null;
    const defenses = batch.defensesByPlanet[planetId] ?? null;
    const research = batch.researchByPlanet[planetId] ?? null;

    for (const { available, detail, reason, surface } of [
      {
        surface: "infrastructure",
        detail: infrastructure,
        available: infrastructure?.infrastructureAvailable,
        reason: infrastructure?.unavailableReason,
      },
      {
        surface: "shipyard",
        detail: shipyard,
        available: shipyard?.productionAvailable,
        reason: shipyard?.unavailableReason,
      },
      {
        surface: "defenses",
        detail: defenses,
        available: defenses?.productionAvailable,
        reason: defenses?.unavailableReason,
      },
      {
        surface: "research",
        detail: research,
        available: research?.researchAvailable,
        reason: research?.unavailableReason,
      },
    ] as const) {
      if (detail === null) {
        unavailable.push({
          surface,
          planetId,
          reason: "detail_unavailable",
          retryable: true,
        });
      } else if (!available || reason != null) {
        unavailable.push({
          surface,
          planetId,
          reason: reason ?? `${surface}_unavailable`,
          retryable: true,
        });
      }
    }

    const { moon, ...planetWithoutMoon } = planet;
    return {
      state: planetSchema.parse({
        ...planetWithoutMoon,
        hasMoon: moon !== null,
      }),
      infrastructure,
      shipyard,
      defenses,
      research,
    };
  });

  const stale =
    batch.overview.stale ||
    batch.overview.indexer.indexedState !== "healthy" ||
    !batch.overview.indexer.safeToServeIndexedState ||
    Object.values(batch.headersBySurface).some(
      (headers) =>
        headers["x-veydrift-index-state"] !== undefined &&
        headers["x-veydrift-index-state"] !== "healthy",
    ) ||
    planets.some(
      (planet) =>
        planet.infrastructure?.stale === true ||
        planet.shipyard?.stale === true ||
        planet.defenses?.stale === true ||
        planet.research?.stale === true,
    );

  const finalizedChainId = hexQuantityToDecimal(batch.rpc.chainId);
  const finalizedBlockNumber = hexQuantityToDecimal(
    batch.rpc.finalizedBlock.number,
  );
  const finalizedTimestamp = hexUnixSecondsToIso(
    batch.rpc.finalizedBlock.timestamp,
  );
  if (
    new Date(finalizedTimestamp) > new Date(parsedObservation.data.observedAt)
  ) {
    throw new SnapshotNormalizationError(
      "INCONSISTENT_SOURCE_BATCH",
      "Finalized block timestamp is later than the local observation",
    );
  }

  try {
    return parseNormalizedSnapshot({
      schemaVersion: 1,
      observedAt: parsedObservation.data.observedAt,
      status: {
        completeness: stale || unavailable.length > 0 ? "partial" : "complete",
        stale,
        unavailable,
      },
      source: {
        upstreamCommit: parsedObservation.data.upstreamCommit,
        service: {
          name: batch.health.service,
          ok: batch.health.ok,
          configured: batch.health.configured,
          ready: batch.health.readiness.ready,
          degraded: batch.health.readiness.degraded,
          configurationReady: batch.health.readiness.configurationReady,
          degradationReasons: batch.health.readiness.degradationReasons,
        },
        deployment:
          batch.runtimeConfig.backend === undefined
            ? null
            : {
                commit: batch.runtimeConfig.backend.build.deploymentCommit,
                abiSha256: batch.runtimeConfig.backend.build.deploymentAbiHash,
                deployedAt:
                  batch.runtimeConfig.backend.build.deploymentTimestamp,
                backendBuildCommit: batch.runtimeConfig.backend.build.gitSha,
                backendBuildSource:
                  batch.runtimeConfig.backend.build.gitShaSource,
              },
        runtime: {
          apiUrl: batch.runtimeConfig.apiUrl,
          chainId: batch.runtimeConfig.chainId,
          network: batch.runtimeConfig.network,
          gameAddress: batch.runtimeConfig.gameContractAddress,
        },
        transport: normalizeHeaders(batch.headersBySurface),
        indexed: {
          source: batch.overview.source,
          stale: batch.overview.stale,
          detail: batch.overview.detail ?? null,
          indexedState: batch.overview.indexer.indexedState,
          safeToServeIndexedState:
            batch.overview.indexer.safeToServeIndexedState,
          latestIndexedBlock: batch.overview.indexer.latestIndexedBlock,
          lastRebuiltAt: batch.overview.indexer.lastRebuiltAt,
          lastReconciledAt: batch.overview.indexer.lastReconciledAt,
          staleReason: batch.overview.indexer.staleReason ?? null,
          fleetGeneratedAt: batch.overview.fleetVisibility.generatedAt,
          fleetIndexedBlock: batch.overview.fleetVisibility.indexedBlock,
          fleetIndexedRevision: batch.overview.fleetVisibility.indexedRevision,
          highscoresGeneratedAt: batch.highscores.generatedAt,
        },
        finalized: {
          chainId: finalizedChainId,
          blockNumber: finalizedBlockNumber,
          blockHash: batch.rpc.finalizedBlock.hash,
          blockTimestamp: finalizedTimestamp,
          sourceEncoding: {
            chainId: "hex-quantity",
            blockNumber: "hex-quantity",
            blockTimestamp: "hex-quantity-unix-seconds",
          },
        },
      },
      player: {
        wallet: playerAddress,
        homePlanetId: batch.overview.settlement.homePlanetId,
        hasFirstPlanet: batch.overview.settlement.hasFirstPlanet,
        profile: playerProfileSchema.parse(batch.overview.settlement.player),
        score: score === null ? null : normalizeHighscoreEntry(score),
        queues: {
          building: batch.overview.queues.building,
          defense: batch.overview.queues.defense,
          ship: batch.overview.queues.ship,
          research:
            batch.overview.planetsResponse.queues?.research ??
            batch.overview.queues.research,
        },
        planets,
        fleets: normalizeFleetVisibility(batch.overview.fleetVisibility),
      },
      universe: {
        highscores: {
          generatedAt: batch.highscores.generatedAt,
          source: batch.highscores.source,
          formula: batch.highscores.formula,
          pagination: batch.highscores.pagination,
          total: batch.highscores.rankings.total.map(normalizeHighscoreEntry),
        },
        activeMissions: batch.activeMissions.missions.map((mission) =>
          missionSchema.parse(mission),
        ),
        systems: batch.systems.map((system) =>
          universeSystemSchema.parse({
            galaxy: system.galaxy,
            system: system.system,
            planets: system.planets.map((planet) => ({
              galaxy: planet.galaxy,
              system: planet.system,
              position: planet.position,
              key: planet.key,
              fields: planet.fields,
              temperature: planet.temperature,
              metalMultiplierBps: planet.metalMultiplierBps,
              crystalMultiplierBps: planet.crystalMultiplierBps,
              deuteriumMultiplierBps: planet.deuteriumMultiplierBps,
              archetype: planet.archetype,
              name: planet.name,
              occupiedBy: planet.occupiedBy,
              hasMoon: planet.hasMoon,
              hasDebrisField: planet.debrisField !== null,
              publicState: planet.publicState,
            })),
          }),
        ),
      },
    });
  } catch {
    throw new SnapshotNormalizationError(
      "INVALID_SOURCE_BATCH",
      "Snapshot source batch could not produce a valid normalized snapshot",
    );
  }
}

function normalizeHighscoreEntry(
  entry: z.infer<typeof sourceHighscoreEntrySchema>,
) {
  return highscoreEntrySchema.parse({
    rank: entry.rank,
    wallet: entry.wallet,
    displayName: entry.displayName,
    homePlanetId: entry.homePlanetId,
    planetCount: entry.planetCount,
    score: entry.score,
    totalUserScore: entry.totalUserScore,
  });
}

function normalizeFleetVisibility(
  fleets: z.infer<typeof sourceFleetVisibilitySchema>,
) {
  return fleetVisibilitySchema.parse({
    wallet: fleets.wallet,
    homePlanetId: fleets.homePlanetId,
    indexedRevision: fleets.indexedRevision,
    indexedBlock: fleets.indexedBlock,
    generatedAt: fleets.generatedAt,
    incoming: fleets.incoming,
    outgoing: fleets.outgoing,
    returning: fleets.returning,
  });
}

function validateDeployment(batch: z.infer<typeof sourceBatchSchema>): void {
  const expected = SUPPORTED_DEPLOYMENT.core;
  const rpcChainId = Number(BigInt(batch.rpc.chainId));
  if (
    batch.runtimeConfig.chainId !== expected.chain.id ||
    rpcChainId !== expected.chain.id ||
    batch.runtimeConfig.contractAddress !== expected.game.proxy.address ||
    batch.runtimeConfig.gameContractAddress !== expected.game.proxy.address ||
    batch.runtimeConfig.apiUrl !== expected.surfaces.apiUrl ||
    batch.runtimeConfig.network !== expected.chain.name
  ) {
    throw new SnapshotNormalizationError(
      "UNSUPPORTED_DEPLOYMENT",
      "Snapshot source does not match the supported Veydrift deployment",
    );
  }

  const build = batch.runtimeConfig.backend?.build;
  if (
    build !== undefined &&
    (build.deploymentCommit !== expected.deployment.commit ||
      build.deploymentAbiHash !== expected.deployment.abiSha256 ||
      build.deploymentTimestamp !== expected.deployment.timestamp)
  ) {
    throw new SnapshotNormalizationError(
      "UNSUPPORTED_DEPLOYMENT",
      "Snapshot source deployment identity is not supported",
    );
  }
}

function validatePlayerConsistency(
  batch: z.infer<typeof sourceBatchSchema>,
  playerAddress: Address,
): void {
  const addresses = [
    batch.overview.settlement.wallet,
    batch.overview.settlement.player.wallet,
    batch.overview.planetsResponse.wallet,
    batch.overview.queues.wallet,
    batch.overview.fleetVisibility.wallet,
  ];
  const optionalPlayer = batch.overview.planetsResponse.player;
  if (optionalPlayer !== undefined) addresses.push(optionalPlayer.wallet);

  const homePlanetIds = [
    batch.overview.settlement.homePlanetId,
    batch.overview.planetsResponse.homePlanetId,
    batch.overview.queues.homePlanetId,
    batch.overview.fleetVisibility.homePlanetId,
  ];

  for (const planet of batch.overview.planetsResponse.planets) {
    addresses.push(planet.owner);
  }
  for (const details of [
    batch.infrastructureByPlanet,
    batch.shipyardByPlanet,
    batch.defensesByPlanet,
    batch.researchByPlanet,
  ]) {
    for (const detail of Object.values(details)) {
      addresses.push(detail.wallet);
      homePlanetIds.push(detail.homePlanetId);
    }
  }

  if (addresses.some((address) => address !== playerAddress)) {
    throw new SnapshotNormalizationError(
      "INCONSISTENT_SOURCE_BATCH",
      "Snapshot source contains inconsistent player identity",
    );
  }

  if (new Set(homePlanetIds).size !== 1) {
    throw new SnapshotNormalizationError(
      "INCONSISTENT_SOURCE_BATCH",
      "Snapshot source contains inconsistent home-planet identity",
    );
  }

  if (
    batch.highscores.rankings.total.some(
      (entry) => entry.totalUserScore !== entry.score.total,
    )
  ) {
    throw new SnapshotNormalizationError(
      "INCONSISTENT_SOURCE_BATCH",
      "Snapshot source contains inconsistent canonical score totals",
    );
  }

  for (const [key, detail] of Object.entries(batch.infrastructureByPlanet)) {
    requirePlanetDetailIdentity(key, detail.planetId, detail.resourceSnapshot);
  }
  for (const [key, detail] of Object.entries(batch.shipyardByPlanet)) {
    requirePlanetDetailIdentity(key, detail.planetId, detail.resourceSnapshot);
  }
  for (const [key, detail] of Object.entries(batch.researchByPlanet)) {
    requirePlanetDetailIdentity(key, detail.planetId, detail.resourceSnapshot);
  }
  for (const [key, detail] of Object.entries(batch.defensesByPlanet)) {
    requirePlanetDetailIdentity(key, key, detail.resourceSnapshot);
  }
}

function requirePlanetDetailIdentity(
  key: string,
  planetId: string,
  resourceSnapshot: z.infer<typeof resourceSnapshotSchema>,
): void {
  if (key !== planetId || resourceSnapshot.planetId !== planetId) {
    throw new SnapshotNormalizationError(
      "INCONSISTENT_SOURCE_BATCH",
      "Snapshot source contains inconsistent planet detail identity",
    );
  }
}

function hexQuantityToDecimal(value: string): string {
  return BigInt(value).toString(10);
}

function hexUnixSecondsToIso(value: string): string {
  const milliseconds = BigInt(value) * 1_000n;
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new SnapshotNormalizationError(
      "INVALID_SOURCE_BATCH",
      "Finalized block timestamp is outside the supported range",
    );
  }

  return new Date(Number(milliseconds)).toISOString();
}

function normalizeHeaders(
  headersBySurface: Readonly<Record<string, Readonly<Record<string, string>>>>,
) {
  return Object.entries(headersBySurface)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([surface, headers]) => {
      const cacheControl = headers["cache-control"];
      const httpDate = headers.date;
      const indexState = headers["x-veydrift-index-state"];
      const retryAfter = headers["retry-after"];

      return {
        surface,
        ...(cacheControl === undefined ? {} : { cacheControl }),
        ...(httpDate === undefined ? {} : { httpDate }),
        ...(indexState === undefined
          ? {}
          : { indexState: sourceIndexStateSchema.parse(indexState) }),
        ...(retryAfter === undefined
          ? {}
          : { retryAfterSeconds: parseRetryAfter(retryAfter) }),
      };
    });
}

function parseRetryAfter(value: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new SnapshotNormalizationError(
      "INVALID_SOURCE_BATCH",
      "Retry-After must be a non-negative integer number of seconds",
    );
  }
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds)) {
    throw new SnapshotNormalizationError(
      "INVALID_SOURCE_BATCH",
      "Retry-After is outside the supported range",
    );
  }
  return seconds;
}
