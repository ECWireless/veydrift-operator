import type { Address } from "viem";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

type Primitive = bigint | boolean | null | number | string | symbol | undefined;

export type DeepReadonly<Value> = Value extends Primitive
  ? Value
  : Value extends ReadonlyArray<infer Item>
    ? ReadonlyArray<DeepReadonly<Item>>
    : { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> };

export const canonicalDecimalSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "must be a canonical non-negative integer");

export const isoTimestampSchema = z.string().refine((value) => {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}, "must be a canonical ISO-8601 timestamp");

export const evmAddressSchema = z
  .string()
  .refine((value) => isAddress(value), "must be a valid EVM address")
  .transform((value): Address => getAddress(value));

export const hashSchema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/, "must be a lowercase 32-byte hex value");

export const sourceIndexStateSchema = z.enum(["healthy", "stale", "not-ready"]);

const nonNegativeIntegerSchema = z.number().int().nonnegative().safe();
const gameTextSchema = z.string();

export const resourcesSchema = z.strictObject({
  metal: canonicalDecimalSchema,
  crystal: canonicalDecimalSchema,
  deuterium: canonicalDecimalSchema,
});

export const resourceSnapshotSchema = z.strictObject({
  planetId: canonicalDecimalSchema,
  transactionHash: hashSchema,
  blockNumber: canonicalDecimalSchema,
  logIndex: canonicalDecimalSchema,
  lastSettledAt: canonicalDecimalSchema,
  resources: resourcesSchema.optional(),
});

const itemCostSchema = resourcesSchema;

export const queueSchema = z.strictObject({
  active: z.boolean(),
  kind: z.enum(["building", "defense", "research", "ship"]),
  planetId: canonicalDecimalSchema,
  itemId: nonNegativeIntegerSchema,
  targetLevel: nonNegativeIntegerSchema.optional(),
  quantity: nonNegativeIntegerSchema.optional(),
  readyAt: canonicalDecimalSchema,
  startedAt: canonicalDecimalSchema.optional(),
  cost: itemCostSchema,
  asOfNow: z.strictObject({
    secondsRemaining: nonNegativeIntegerSchema,
    complete: z.boolean(),
    remainingQuantity: nonNegativeIntegerSchema.optional(),
    overallProgressBps: nonNegativeIntegerSchema.optional(),
  }),
});

export const playerProfileSchema = z.strictObject({
  wallet: evmAddressSchema,
  displayName: gameTextSchema.nullable(),
  description: gameTextSchema.nullable(),
  fallbackName: gameTextSchema,
  updatedAt: isoTimestampSchema.nullable(),
});

const technologyLevelsSchema = z.record(
  canonicalDecimalSchema,
  nonNegativeIntegerSchema,
);

const buildableItemSchema = z.strictObject({
  id: nonNegativeIntegerSchema,
  level: nonNegativeIntegerSchema.optional(),
  count: nonNegativeIntegerSchema.optional(),
  durationSeconds: nonNegativeIntegerSchema,
  cost: itemCostSchema,
});

export const infrastructureSchema = z.strictObject({
  wallet: evmAddressSchema,
  homePlanetId: canonicalDecimalSchema,
  planetId: canonicalDecimalSchema,
  source: z.string().trim().min(1),
  stale: z.boolean(),
  unavailableReason: gameTextSchema.nullable().optional(),
  infrastructureAvailable: z.boolean(),
  planetLastSettledAt: canonicalDecimalSchema,
  resources: resourcesSchema,
  resourcesAsOfNow: resourcesSchema,
  productionPerHour: resourcesSchema,
  storageCaps: resourcesSchema,
  protectedResources: resourcesSchema,
  raidableResources: resourcesSchema,
  crawlerProduction: z.strictObject({
    total: nonNegativeIntegerSchema,
    effective: nonNegativeIntegerSchema,
    maxEffective: nonNegativeIntegerSchema,
    boostBps: canonicalDecimalSchema,
    capped: z.boolean(),
    productionIncreasePerHour: resourcesSchema,
  }),
  energyBalance: z.strictObject({
    produced: canonicalDecimalSchema,
    required: canonicalDecimalSchema,
    scaleBps: canonicalDecimalSchema,
  }),
  technologyLevels: technologyLevelsSchema,
  buildings: z.array(buildableItemSchema),
  queue: queueSchema.nullable(),
  resourceSnapshot: resourceSnapshotSchema,
});

export const shipyardSchema = z.strictObject({
  wallet: evmAddressSchema,
  homePlanetId: canonicalDecimalSchema,
  planetId: canonicalDecimalSchema,
  source: z.string().trim().min(1),
  stale: z.boolean(),
  unavailableReason: gameTextSchema.nullable().optional(),
  productionAvailable: z.boolean(),
  shipyardLevel: nonNegativeIntegerSchema,
  naniteLevel: nonNegativeIntegerSchema,
  technologyLevels: technologyLevelsSchema,
  fleetSlots: z.strictObject({
    active: nonNegativeIntegerSchema,
    limit: nonNegativeIntegerSchema,
  }),
  fleetLaunchAvailable: z.boolean(),
  ships: z.array(buildableItemSchema),
  launchableShips: z.array(buildableItemSchema),
  queue: queueSchema.nullable(),
  resources: resourcesSchema,
  resourcesAsOfNow: resourcesSchema,
  resourceSnapshot: resourceSnapshotSchema,
});

export const defensesSchema = z.strictObject({
  wallet: evmAddressSchema,
  homePlanetId: canonicalDecimalSchema,
  source: z.string().trim().min(1),
  stale: z.boolean(),
  unavailableReason: gameTextSchema.nullable().optional(),
  productionAvailable: z.boolean(),
  shipyardLevel: nonNegativeIntegerSchema,
  naniteLevel: nonNegativeIntegerSchema,
  missileSiloLevel: nonNegativeIntegerSchema,
  technologyLevels: technologyLevelsSchema,
  defenses: z.array(buildableItemSchema),
  queue: queueSchema.nullable(),
  resources: resourcesSchema,
  resourcesAsOfNow: resourcesSchema,
  resourceSnapshot: resourceSnapshotSchema,
});

export const researchSchema = z.strictObject({
  wallet: evmAddressSchema,
  homePlanetId: canonicalDecimalSchema,
  planetId: canonicalDecimalSchema,
  source: z.string().trim().min(1),
  stale: z.boolean(),
  unavailableReason: gameTextSchema.nullable().optional(),
  researchAvailable: z.boolean(),
  researchLabLevel: nonNegativeIntegerSchema,
  researchNetworkLabLevels: z.array(nonNegativeIntegerSchema),
  technologyLevels: technologyLevelsSchema,
  technologies: z.array(buildableItemSchema),
  queue: queueSchema.nullable(),
  resources: resourcesSchema,
  resourcesAsOfNow: resourcesSchema,
  resourceSnapshot: resourceSnapshotSchema,
});

const tacticalSchema = z.strictObject({
  currentResources: resourcesSchema,
  raidableResources: resourcesSchema,
  raidableResourceTotal: canonicalDecimalSchema,
  grossResourceTotal: canonicalDecimalSchema,
  productionPerHour: resourcesSchema,
  storageCaps: resourcesSchema,
  ships: z.strictObject({
    count: nonNegativeIntegerSchema,
    power: canonicalDecimalSchema,
  }),
  defenses: z.strictObject({
    count: nonNegativeIntegerSchema,
    power: canonicalDecimalSchema,
  }),
  combatPower: canonicalDecimalSchema,
});

export const planetSchema = z.strictObject({
  planetId: canonicalDecimalSchema,
  owner: evmAddressSchema,
  name: gameTextSchema,
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
  resourceSnapshot: resourceSnapshotSchema,
  keyLevels: z.record(z.string().trim().min(1), nonNegativeIntegerSchema),
  queues: z.strictObject({
    building: queueSchema.nullable(),
    defense: queueSchema.nullable(),
    ship: queueSchema.nullable(),
  }),
  hasMoon: z.boolean(),
  tactical: tacticalSchema,
});

export const missionSchema = z.strictObject({
  missionId: canonicalDecimalSchema,
  status: gameTextSchema,
  missionType: gameTextSchema,
  owner: evmAddressSchema,
  originPlanetId: canonicalDecimalSchema,
  targetPlanetId: canonicalDecimalSchema,
  arrivalAt: canonicalDecimalSchema,
  returnAt: canonicalDecimalSchema,
  ships: z.record(canonicalDecimalSchema, canonicalDecimalSchema),
  cargo: resourcesSchema,
  blockNumber: canonicalDecimalSchema,
  transactionHash: hashSchema,
});

export const fleetVisibilitySchema = z.strictObject({
  wallet: evmAddressSchema,
  homePlanetId: canonicalDecimalSchema.nullable(),
  indexedRevision: z.string().trim().min(1),
  indexedBlock: canonicalDecimalSchema,
  generatedAt: isoTimestampSchema,
  incoming: z.array(missionSchema),
  outgoing: z.array(missionSchema),
  returning: z.array(missionSchema),
});

export const scoreSchema = z.strictObject({
  total: canonicalDecimalSchema,
  economy: canonicalDecimalSchema,
  research: canonicalDecimalSchema,
  military: canonicalDecimalSchema,
  fleet: canonicalDecimalSchema,
  fleetCount: canonicalDecimalSchema,
  defense: canonicalDecimalSchema,
  researchLevels: canonicalDecimalSchema,
});

export const highscoreEntrySchema = z.strictObject({
  rank: z.number().int().positive().safe(),
  wallet: evmAddressSchema,
  displayName: gameTextSchema.nullable(),
  homePlanetId: canonicalDecimalSchema.nullable(),
  planetCount: nonNegativeIntegerSchema,
  score: scoreSchema,
  totalUserScore: canonicalDecimalSchema,
});

export const highscoreSnapshotSchema = z.strictObject({
  generatedAt: isoTimestampSchema,
  source: z.string().trim().min(1),
  formula: z.strictObject({
    pointsDivisor: canonicalDecimalSchema,
    summary: gameTextSchema,
    target: z.literal("totalUserScore"),
    excludedCategories: z.array(gameTextSchema),
  }),
  pagination: z.strictObject({
    page: z.number().int().positive().safe(),
    pageSize: z.number().int().positive().safe(),
    totalEntries: nonNegativeIntegerSchema,
    totalPages: nonNegativeIntegerSchema,
    hasPreviousPage: z.boolean(),
    hasNextPage: z.boolean(),
  }),
  total: z.array(highscoreEntrySchema),
});

const universePublicItemSchema = z.strictObject({
  id: nonNegativeIntegerSchema,
  level: nonNegativeIntegerSchema.optional(),
  count: nonNegativeIntegerSchema.optional(),
});

export const universeSystemSchema = z.strictObject({
  galaxy: nonNegativeIntegerSchema,
  system: nonNegativeIntegerSchema,
  planets: z.array(
    z.strictObject({
      galaxy: nonNegativeIntegerSchema,
      system: nonNegativeIntegerSchema,
      position: nonNegativeIntegerSchema,
      key: z.string().trim().min(1),
      fields: nonNegativeIntegerSchema,
      temperature: z.number().int().safe(),
      metalMultiplierBps: nonNegativeIntegerSchema,
      crystalMultiplierBps: nonNegativeIntegerSchema,
      deuteriumMultiplierBps: nonNegativeIntegerSchema,
      archetype: gameTextSchema,
      name: gameTextSchema,
      occupiedBy: z
        .strictObject({
          planetId: canonicalDecimalSchema,
          owner: evmAddressSchema,
          ownerDisplayName: gameTextSchema.nullable(),
          alliance: gameTextSchema.nullable(),
        })
        .nullable(),
      hasMoon: z.boolean(),
      hasDebrisField: z.boolean(),
      publicState: z
        .strictObject({
          resources: resourcesSchema,
          buildings: z.array(universePublicItemSchema),
          fleet: z.array(universePublicItemSchema),
          defenses: z.array(universePublicItemSchema),
        })
        .nullable(),
    }),
  ),
});

const availabilityIssueSchema = z.strictObject({
  surface: z.string().trim().min(1),
  planetId: canonicalDecimalSchema.optional(),
  reason: gameTextSchema,
  retryable: z.boolean(),
  kind: z.string().trim().min(1).optional(),
  status: z.number().int().positive().safe().optional(),
});

export type SnapshotAvailabilityIssue = z.infer<typeof availabilityIssueSchema>;

const transportFreshnessSchema = z.strictObject({
  surface: z.string().trim().min(1),
  cacheControl: z.string().trim().min(1).optional(),
  httpDate: z.string().trim().min(1).optional(),
  indexState: sourceIndexStateSchema.optional(),
  retryAfterSeconds: nonNegativeIntegerSchema.optional(),
});

const normalizedPlanetSchema = z.strictObject({
  state: planetSchema,
  infrastructure: infrastructureSchema.nullable(),
  shipyard: shipyardSchema.nullable(),
  defenses: defensesSchema.nullable(),
  research: researchSchema.nullable(),
});

export const normalizedSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  observedAt: isoTimestampSchema,
  status: z.strictObject({
    completeness: z.enum(["complete", "partial"]),
    stale: z.boolean(),
    unavailable: z.array(availabilityIssueSchema),
  }),
  source: z.strictObject({
    upstreamCommit: z
      .string()
      .regex(/^[0-9a-f]{40}$/, "must be a lowercase, full Git commit SHA"),
    service: z.strictObject({
      name: z.string().trim().min(1),
      ok: z.boolean(),
      configured: z.boolean(),
      ready: z.boolean(),
      degraded: z.boolean(),
      configurationReady: z.boolean(),
      degradationReasons: z.array(gameTextSchema),
    }),
    deployment: z
      .strictObject({
        commit: z
          .string()
          .regex(/^[0-9a-f]{40}$/, "must be a lowercase, full Git commit SHA"),
        abiSha256: z
          .string()
          .regex(/^sha256:[0-9a-f]{64}$/, "must be a lowercase sha256 digest"),
        deployedAt: isoTimestampSchema,
        backendBuildCommit: z
          .string()
          .regex(/^[0-9a-f]{40}$/, "must be a lowercase, full Git commit SHA"),
        backendBuildSource: z.string().trim().min(1),
      })
      .nullable(),
    runtime: z.strictObject({
      apiUrl: z.string().url(),
      chainId: z.number().int().positive().safe(),
      network: z.string().trim().min(1),
      gameAddress: evmAddressSchema,
    }),
    transport: z.array(transportFreshnessSchema),
    indexed: z.strictObject({
      source: z.string().trim().min(1),
      stale: z.boolean(),
      detail: gameTextSchema.nullable(),
      indexedState: sourceIndexStateSchema,
      safeToServeIndexedState: z.boolean(),
      latestIndexedBlock: canonicalDecimalSchema,
      lastRebuiltAt: isoTimestampSchema.nullable(),
      lastReconciledAt: isoTimestampSchema.nullable(),
      staleReason: gameTextSchema.nullable(),
      fleetGeneratedAt: isoTimestampSchema,
      fleetIndexedBlock: canonicalDecimalSchema,
      fleetIndexedRevision: z.string().trim().min(1),
      highscoresGeneratedAt: isoTimestampSchema,
    }),
    finalized: z.strictObject({
      chainId: canonicalDecimalSchema,
      blockNumber: canonicalDecimalSchema,
      blockHash: hashSchema,
      blockTimestamp: isoTimestampSchema,
      sourceEncoding: z.strictObject({
        chainId: z.literal("hex-quantity"),
        blockNumber: z.literal("hex-quantity"),
        blockTimestamp: z.literal("hex-quantity-unix-seconds"),
      }),
    }),
  }),
  player: z.strictObject({
    wallet: evmAddressSchema,
    homePlanetId: canonicalDecimalSchema.nullable(),
    hasFirstPlanet: z.boolean(),
    profile: playerProfileSchema,
    score: highscoreEntrySchema.nullable(),
    queues: z.strictObject({
      building: queueSchema.nullable(),
      defense: queueSchema.nullable(),
      ship: queueSchema.nullable(),
      research: queueSchema.nullable(),
    }),
    planets: z.array(normalizedPlanetSchema),
    fleets: fleetVisibilitySchema,
  }),
  universe: z.strictObject({
    highscores: highscoreSnapshotSchema,
    activeMissions: z.array(missionSchema),
    systems: z.array(universeSystemSchema),
  }),
});

type ParsedNormalizedSnapshot = z.infer<typeof normalizedSnapshotSchema>;

export type NormalizedSnapshot = DeepReadonly<ParsedNormalizedSnapshot>;

export function parseNormalizedSnapshot(input: unknown): NormalizedSnapshot {
  return deepFreeze(normalizedSnapshotSchema.parse(input));
}

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<Value>;
  }

  for (const property of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[property]);
  }

  return Object.freeze(value) as DeepReadonly<Value>;
}
