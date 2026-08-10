import { describe, expect, test } from "bun:test";

import type {
  PublicApiAdapter,
  PublicApiReadResult,
  PublicRpcAdapter,
} from "../src/public-read-adapters.ts";
import { PublicReadTransportError } from "../src/public-read-adapters.ts";
import {
  OneShotSnapshotCollector,
  SnapshotCollectionError,
} from "../src/snapshot-collector.ts";
import partial from "./fixtures/snapshot-source/partial.json" with {
  type: "json",
};
import representative from "./fixtures/snapshot-source/representative.json" with {
  type: "json",
};

const PLAYER_ADDRESS = "0x1111111111111111111111111111111111111111";
const WALLET_PATH = `/wallet/${PLAYER_ADDRESS}`;
const PRIMARY_DETAIL_PATHS = [
  `${WALLET_PATH}/infrastructure?planetId=101`,
  `${WALLET_PATH}/shipyard?planetId=101`,
  `${WALLET_PATH}/defenses?planetId=101`,
  `${WALLET_PATH}/research?planetId=101`,
];
const PRIMARY_SYSTEM_PATH = "/universe/galaxies/0/systems/7?detail=full";
const HIGHSCORE_PATH = "/highscores?category=total&live=1&page=1&pageSize=100";
const ACTIVE_MISSIONS_PATH = "/missions?status=active&live=1";

class MemoryApiAdapter implements PublicApiAdapter {
  readonly calls: string[] = [];
  readonly failures = new Map<string, Error>();
  readonly responses: Map<string, PublicApiReadResult>;

  constructor(responses = representativeResponses()) {
    this.responses = responses;
  }

  async get(path: string): Promise<PublicApiReadResult> {
    this.calls.push(path);
    const failure = this.failures.get(path);
    if (failure !== undefined) throw failure;
    const response = this.responses.get(path);
    if (response === undefined)
      throw new Error(`Missing fake response for ${path}`);
    return response;
  }
}

class MemoryRpcAdapter implements PublicRpcAdapter {
  readonly calls: string[] = [];
  chainId: unknown = representative.rpc.chainId;
  finalizedBlock: unknown = representative.rpc.finalizedBlock;

  async getChainId(): Promise<unknown> {
    this.calls.push("eth_chainId");
    return this.chainId;
  }

  async getFinalizedBlock(): Promise<unknown> {
    this.calls.push("eth_getBlockByNumber:finalized");
    return this.finalizedBlock;
  }
}

function response(
  body: unknown,
  headers: Readonly<Record<string, string>> = {
    "cache-control": "no-store",
    "x-veydrift-index-state": "healthy",
  },
): PublicApiReadResult {
  return { body, headers };
}

function representativeResponses(): Map<string, PublicApiReadResult> {
  return new Map([
    ["/runtime-config", response(representative.runtimeConfig, {})],
    ["/health", response(representative.health, {})],
    [
      `${WALLET_PATH}/overview`,
      response(
        representative.overview,
        representative.headersBySurface.overview,
      ),
    ],
    [
      PRIMARY_DETAIL_PATHS[0] ?? "",
      response(representative.infrastructureByPlanet["101"]),
    ],
    [
      PRIMARY_DETAIL_PATHS[1] ?? "",
      response(representative.shipyardByPlanet["101"]),
    ],
    [
      PRIMARY_DETAIL_PATHS[2] ?? "",
      response(representative.defensesByPlanet["101"]),
    ],
    [
      PRIMARY_DETAIL_PATHS[3] ?? "",
      response(representative.researchByPlanet["101"]),
    ],
    [
      PRIMARY_SYSTEM_PATH,
      response(
        representative.systems[0],
        representative.headersBySurface.universeSystem,
      ),
    ],
    [
      HIGHSCORE_PATH,
      response(
        representative.highscores,
        representative.headersBySurface.highscores,
      ),
    ],
    [
      ACTIVE_MISSIONS_PATH,
      response(
        representative.activeMissions,
        representative.headersBySurface.activeMissions,
      ),
    ],
  ]);
}

function createCollector(
  api: PublicApiAdapter,
  rpc: PublicRpcAdapter = new MemoryRpcAdapter(),
): OneShotSnapshotCollector {
  return new OneShotSnapshotCollector({
    api,
    rpc,
    clock: () => new Date(representative.fixture.observedAt),
  });
}

function expectCollectionError(
  operation: Promise<unknown>,
): Promise<SnapshotCollectionError> {
  return operation.then(
    () => {
      throw new Error("Expected snapshot collection to fail");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(SnapshotCollectionError);
      return error as SnapshotCollectionError;
    },
  );
}

describe("one-shot snapshot collector", () => {
  test("collects and normalizes the primary planet before global context", async () => {
    const api = new MemoryApiAdapter();
    const rpc = new MemoryRpcAdapter();

    const snapshot = await createCollector(api, rpc).collect(PLAYER_ADDRESS);

    expect(snapshot.status).toEqual({
      completeness: "complete",
      stale: false,
      unavailable: [],
    });
    expect(snapshot.player.planets[0]?.state.planetId).toBe("101");
    expect(snapshot.player.planets[0]?.infrastructure?.planetId).toBe("101");
    expect(snapshot.source.upstreamCommit).toBe(
      representative.runtimeConfig.backend.build.gitSha,
    );
    expect(snapshot.source.transport).toContainEqual({
      surface: "infrastructure:101",
      cacheControl: "no-store",
      indexState: "healthy",
    });
    expect(rpc.calls).toEqual([
      "eth_chainId",
      "eth_getBlockByNumber:finalized",
    ]);
    expect(api.calls).toEqual([
      "/runtime-config",
      "/health",
      `${WALLET_PATH}/overview`,
      ...PRIMARY_DETAIL_PATHS,
      PRIMARY_SYSTEM_PATH,
      HIGHSCORE_PATH,
      ACTIVE_MISSIONS_PATH,
    ]);
  });

  test("waits for the primary bundle before secondary and global fan-out", async () => {
    const responses = representativeResponses();
    const overview = structuredClone(representative.overview);
    const primary = overview.planetsResponse.planets[0];
    if (primary === undefined)
      throw new Error("Representative planet is missing");
    const secondary = structuredClone(primary);
    secondary.planetId = "102";
    secondary.name = "Synthetic Secondary";
    secondary.system = 8;
    secondary.coordinates = "[0:8:4]";
    secondary.position = 4;
    secondary.isHomePlanet = false;
    secondary.resourceSnapshot.planetId = "102";
    (secondary.queues as { ship: unknown }).ship = null;
    overview.planetsResponse.planets.push(secondary);
    responses.set(
      `${WALLET_PATH}/overview`,
      response(overview, representative.headersBySurface.overview),
    );

    addSecondaryDetailResponses(responses);
    const secondarySystem = structuredClone(representative.systems[0]);
    if (secondarySystem === undefined) {
      throw new Error("Representative system is missing");
    }
    secondarySystem.system = 8;
    for (const planet of secondarySystem.planets) {
      planet.system = 8;
      planet.position = 4;
      planet.key = "0:8:4";
      if (planet.occupiedBy !== null) {
        planet.occupiedBy.planetId = "102";
      }
    }
    const secondarySystemPath = "/universe/galaxies/0/systems/8?detail=full";
    responses.set(secondarySystemPath, response(secondarySystem));
    const api = new MemoryApiAdapter(responses);

    const snapshot = await createCollector(api).collect(PLAYER_ADDRESS);

    expect(
      snapshot.player.planets.map((planet) => planet.state.planetId),
    ).toEqual(["101", "102"]);
    const primaryEnd = Math.max(
      ...[...PRIMARY_DETAIL_PATHS, PRIMARY_SYSTEM_PATH].map((path) =>
        api.calls.indexOf(path),
      ),
    );
    for (const path of [
      `${WALLET_PATH}/infrastructure?planetId=102`,
      `${WALLET_PATH}/shipyard?planetId=102`,
      `${WALLET_PATH}/defenses?planetId=102`,
      `${WALLET_PATH}/research?planetId=102`,
      secondarySystemPath,
      HIGHSCORE_PATH,
      ACTIVE_MISSIONS_PATH,
    ]) {
      expect(api.calls.indexOf(path)).toBeGreaterThan(primaryEnd);
    }
  });

  test("deduplicates managed systems after collecting the primary system", async () => {
    const responses = representativeResponses();
    const overview = structuredClone(representative.overview);
    const primary = overview.planetsResponse.planets[0];
    if (primary === undefined)
      throw new Error("Representative planet is missing");
    const secondary = structuredClone(primary);
    secondary.planetId = "102";
    secondary.position = 4;
    secondary.coordinates = "[0:7:4]";
    secondary.isHomePlanet = false;
    secondary.resourceSnapshot.planetId = "102";
    (secondary.queues as { ship: unknown }).ship = null;
    overview.planetsResponse.planets.push(secondary);
    responses.set(`${WALLET_PATH}/overview`, response(overview));
    addSecondaryDetailResponses(responses);
    const api = new MemoryApiAdapter(responses);

    await createCollector(api).collect(PLAYER_ADDRESS);

    expect(
      api.calls.filter((path) => path === PRIMARY_SYSTEM_PATH),
    ).toHaveLength(1);
  });

  test("stops before secondary and global requests when the primary bundle fails", async () => {
    const api = new MemoryApiAdapter();
    const primaryResearchPath = PRIMARY_DETAIL_PATHS[3];
    if (primaryResearchPath === undefined) {
      throw new Error("Primary research path is missing");
    }
    api.failures.set(
      primaryResearchPath,
      new PublicReadTransportError("API_HTTP_ERROR", {
        status: 429,
        retryAfterSeconds: 10,
      }),
    );

    const error = await expectCollectionError(
      createCollector(api).collect(PLAYER_ADDRESS),
    );

    expect(error).toMatchObject({
      code: "API_REQUEST_FAILED",
      surface: "research:101",
      status: 429,
      retryAfterSeconds: 10,
    });
    expect(api.calls).not.toContain(HIGHSCORE_PATH);
    expect(api.calls).not.toContain(ACTIVE_MISSIONS_PATH);
  });

  test("stops before global requests when primary state is malformed", async () => {
    const responses = representativeResponses();
    const malformedInfrastructure = structuredClone(
      representative.infrastructureByPlanet["101"],
    ) as Record<string, unknown>;
    delete malformedInfrastructure.resourceSnapshot;
    const primaryInfrastructurePath = PRIMARY_DETAIL_PATHS[0];
    if (primaryInfrastructurePath === undefined) {
      throw new Error("Primary infrastructure path is missing");
    }
    responses.set(primaryInfrastructurePath, response(malformedInfrastructure));
    const api = new MemoryApiAdapter(responses);

    const error = await expectCollectionError(
      createCollector(api).collect(PLAYER_ADDRESS),
    );

    expect(error).toMatchObject({
      code: "INVALID_SOURCE_BATCH",
      surface: "infrastructure:101",
    });
    expect(api.calls).not.toContain(HIGHSCORE_PATH);
    expect(api.calls).not.toContain(ACTIVE_MISSIONS_PATH);
  });

  test("does not open fan-out when primary state is explicitly unavailable", async () => {
    const responses = representativeResponses();
    const unavailableInfrastructure = structuredClone(
      representative.infrastructureByPlanet["101"],
    );
    unavailableInfrastructure.infrastructureAvailable = false;
    const primaryInfrastructurePath = PRIMARY_DETAIL_PATHS[0];
    if (primaryInfrastructurePath === undefined) {
      throw new Error("Primary infrastructure path is missing");
    }
    responses.set(
      primaryInfrastructurePath,
      response(unavailableInfrastructure),
    );
    const api = new MemoryApiAdapter(responses);

    const error = await expectCollectionError(
      createCollector(api).collect(PLAYER_ADDRESS),
    );

    expect(error).toMatchObject({
      code: "INVALID_SOURCE_BATCH",
      surface: "infrastructure:101",
    });
    expect(api.calls).not.toContain(HIGHSCORE_PATH);
    expect(api.calls).not.toContain(ACTIVE_MISSIONS_PATH);
  });

  test("rejects cross-wallet overview data before primary requests", async () => {
    const responses = representativeResponses();
    const overview = structuredClone(representative.overview);
    overview.settlement.wallet = "0x2222222222222222222222222222222222222222";
    responses.set(`${WALLET_PATH}/overview`, response(overview));
    const api = new MemoryApiAdapter(responses);

    const error = await expectCollectionError(
      createCollector(api).collect(PLAYER_ADDRESS),
    );

    expect(error).toMatchObject({
      code: "INVALID_OVERVIEW",
      surface: "overview",
    });
    expect(api.calls.some((path) => path.includes("planetId="))).toBe(false);
    expect(api.calls).not.toContain(HIGHSCORE_PATH);
  });

  test("rejects misrouted primary detail and system responses before fan-out", async () => {
    const detailResponses = representativeResponses();
    const misroutedInfrastructure = structuredClone(
      representative.infrastructureByPlanet["101"],
    );
    misroutedInfrastructure.planetId = "102";
    misroutedInfrastructure.resourceSnapshot.planetId = "102";
    const primaryInfrastructurePath = PRIMARY_DETAIL_PATHS[0];
    if (primaryInfrastructurePath === undefined) {
      throw new Error("Primary infrastructure path is missing");
    }
    detailResponses.set(
      primaryInfrastructurePath,
      response(misroutedInfrastructure),
    );
    const detailApi = new MemoryApiAdapter(detailResponses);

    const detailError = await expectCollectionError(
      createCollector(detailApi).collect(PLAYER_ADDRESS),
    );
    expect(detailError).toMatchObject({
      code: "INVALID_SOURCE_BATCH",
      surface: "infrastructure:101",
    });
    expect(detailApi.calls).not.toContain(HIGHSCORE_PATH);

    const systemResponses = representativeResponses();
    const misroutedSystem = structuredClone(representative.systems[0]);
    if (misroutedSystem === undefined) {
      throw new Error("Representative system is missing");
    }
    misroutedSystem.system = 8;
    systemResponses.set(PRIMARY_SYSTEM_PATH, response(misroutedSystem));
    const systemApi = new MemoryApiAdapter(systemResponses);

    const systemError = await expectCollectionError(
      createCollector(systemApi).collect(PLAYER_ADDRESS),
    );
    expect(systemError).toMatchObject({
      code: "INVALID_SOURCE_BATCH",
      surface: "universeSystem:0:7",
    });
    expect(systemApi.calls).not.toContain(HIGHSCORE_PATH);
  });

  test("rejects runtime and RPC mismatches before player requests", async () => {
    const runtimeResponses = representativeResponses();
    const runtime = structuredClone(representative.runtimeConfig);
    runtime.chainId = 1;
    runtimeResponses.set("/runtime-config", response(runtime));
    const runtimeApi = new MemoryApiAdapter(runtimeResponses);

    const runtimeError = await expectCollectionError(
      createCollector(runtimeApi).collect(PLAYER_ADDRESS),
    );
    expect(runtimeError.code).toBe("UNSUPPORTED_BOOTSTRAP");
    expect(runtimeApi.calls).toEqual(["/runtime-config"]);

    const rpcApi = new MemoryApiAdapter();
    const rpc = new MemoryRpcAdapter();
    rpc.chainId = "0x1";
    const rpcError = await expectCollectionError(
      createCollector(rpcApi, rpc).collect(PLAYER_ADDRESS),
    );
    expect(rpcError.code).toBe("UNSUPPORTED_BOOTSTRAP");
    expect(rpcApi.calls).toEqual(["/runtime-config", "/health"]);
    expect(rpc.calls).toEqual(["eth_chainId"]);
  });

  test("preserves an explicit no-settlement state without planet requests", async () => {
    const responses = representativeResponses();
    const overview = structuredClone(representative.overview);
    overview.settlement.hasFirstPlanet = false;
    (
      overview.settlement as {
        homePlanetId: string | null;
        planet: unknown | null;
      }
    ).homePlanetId = null;
    (
      overview.settlement as {
        homePlanetId: string | null;
        planet: unknown | null;
      }
    ).planet = null;
    (
      overview.planetsResponse as {
        homePlanetId: string | null;
      }
    ).homePlanetId = null;
    overview.planetsResponse.planets = [];
    if (overview.planetsResponse.queues !== undefined) {
      (
        overview.planetsResponse.queues as {
          research: unknown | null;
        }
      ).research = null;
    }
    (overview.queues as { homePlanetId: string | null }).homePlanetId = null;
    (
      overview.fleetVisibility as {
        homePlanetId: string | null;
      }
    ).homePlanetId = null;
    overview.fleetVisibility.outgoing = [];
    responses.set(`${WALLET_PATH}/overview`, response(overview));
    const highscores = structuredClone(representative.highscores);
    const playerScore = highscores.rankings.total.find(
      (entry) => entry.wallet === PLAYER_ADDRESS,
    );
    if (playerScore === undefined) throw new Error("Player score is missing");
    (playerScore as { homePlanetId: string | null }).homePlanetId = null;
    playerScore.planetCount = 0;
    responses.set(HIGHSCORE_PATH, response(highscores));
    responses.set(ACTIVE_MISSIONS_PATH, response(partial.activeMissions));
    const api = new MemoryApiAdapter(responses);

    const snapshot = await createCollector(api).collect(PLAYER_ADDRESS);

    expect(snapshot.player.hasFirstPlanet).toBe(false);
    expect(snapshot.player.homePlanetId).toBeNull();
    expect(snapshot.player.planets).toEqual([]);
    expect(api.calls.some((path) => path.includes("planetId="))).toBe(false);
    expect(api.calls.some((path) => path.startsWith("/universe/"))).toBe(false);
  });
});

function addSecondaryDetailResponses(
  responses: Map<string, PublicApiReadResult>,
): void {
  const infrastructure = structuredClone(
    representative.infrastructureByPlanet["101"],
  );
  infrastructure.planetId = "102";
  infrastructure.resourceSnapshot.planetId = "102";
  responses.set(
    `${WALLET_PATH}/infrastructure?planetId=102`,
    response(infrastructure),
  );

  const shipyard = structuredClone(representative.shipyardByPlanet["101"]);
  shipyard.planetId = "102";
  shipyard.resourceSnapshot.planetId = "102";
  responses.set(`${WALLET_PATH}/shipyard?planetId=102`, response(shipyard));

  const defenses = structuredClone(representative.defensesByPlanet["101"]);
  defenses.resourceSnapshot.planetId = "102";
  responses.set(`${WALLET_PATH}/defenses?planetId=102`, response(defenses));

  const research = structuredClone(representative.researchByPlanet["101"]);
  research.planetId = "102";
  research.resourceSnapshot.planetId = "102";
  responses.set(`${WALLET_PATH}/research?planetId=102`, response(research));
}
