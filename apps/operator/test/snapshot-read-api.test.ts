import { describe, expect, test } from "bun:test";

import { createSnapshotDigest } from "../src/snapshot-digest.ts";
import {
  normalizeSnapshot,
  type SnapshotObservation,
} from "../src/snapshot-normalizer.ts";
import {
  createSnapshotReadHandler,
  SNAPSHOT_READ_API_PATH,
  SNAPSHOT_READ_API_VERSION,
  type SnapshotViewProvider,
} from "../src/snapshot-read-api.ts";
import type { NormalizedSnapshot } from "../src/snapshot.ts";
import type {
  SnapshotWorkerStatus,
  SnapshotWorkerView,
} from "../src/snapshot-worker.ts";
import representative from "./fixtures/snapshot-source/representative.json" with {
  type: "json",
};

const PLAYER_ADDRESS = "0x1111111111111111111111111111111111111111";
const API_URL = `http://127.0.0.1:3000${SNAPSHOT_READ_API_PATH}`;

describe("snapshot read API", () => {
  test("returns collection status while the first snapshot is pending", async () => {
    const handler = createSnapshotReadHandler(
      provider({ snapshot: null, status: workerStatus() }),
    );

    const response = handler(new Request(API_URL));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({
      apiVersion: SNAPSHOT_READ_API_VERSION,
      status: workerStatus(),
      snapshot: null,
      digest: null,
    });
  });

  test("returns a matching snapshot and caches its digest by identity", async () => {
    const snapshot = representativeSnapshot();
    let digestCalls = 0;
    const handler = createSnapshotReadHandler(
      provider({
        snapshot,
        status: workerStatus({
          phase: "ready",
          attempts: 1,
          hasSnapshot: true,
          lastAttemptAt: snapshot.observedAt,
          lastSuccessAt: snapshot.observedAt,
          nextRefreshAt: "2026-08-10T15:54:41.000Z",
        }),
      }),
      (input) => {
        digestCalls += 1;
        return createSnapshotDigest(input);
      },
    );

    const first = await handler(new Request(`${API_URL}?ignored=true`)).json();
    const second = await handler(new Request(API_URL)).json();

    expect(digestCalls).toBe(1);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      apiVersion: 1,
      status: { phase: "ready", hasSnapshot: true },
      snapshot: {
        observedAt: snapshot.observedAt,
        player: { wallet: PLAYER_ADDRESS },
      },
      digest: {
        observedAt: snapshot.observedAt,
        player: { wallet: PLAYER_ADDRESS },
      },
    });
  });

  test("returns the retained snapshot with sanitized refresh failure state", async () => {
    const snapshot = representativeSnapshot();
    const handler = createSnapshotReadHandler(
      provider({
        snapshot,
        status: workerStatus({
          phase: "degraded",
          attempts: 2,
          consecutiveFailures: 1,
          hasSnapshot: true,
          lastError: {
            code: "API_REQUEST_FAILED",
            occurredAt: "2026-08-10T15:54:41.000Z",
            retryable: true,
            surface: "overview",
          },
          lastSuccessAt: snapshot.observedAt,
          retainedAfterFailure: true,
        }),
      }),
    );

    const body = await handler(new Request(API_URL)).json();

    expect(body).toMatchObject({
      status: {
        phase: "degraded",
        consecutiveFailures: 1,
        retainedAfterFailure: true,
        lastError: {
          code: "API_REQUEST_FAILED",
          retryable: true,
          surface: "overview",
        },
      },
      snapshot: { observedAt: snapshot.observedAt },
      digest: { observedAt: snapshot.observedAt },
    });
  });

  test("rejects unknown routes and non-GET methods", async () => {
    const handler = createSnapshotReadHandler(
      provider({ snapshot: null, status: workerStatus() }),
    );

    const missing = handler(new Request("http://127.0.0.1:3000/nope"));
    const method = handler(new Request(API_URL, { method: "POST" }));

    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: { code: "NOT_FOUND" } });
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("GET");
    expect(await method.json()).toEqual({
      error: { code: "METHOD_NOT_ALLOWED" },
    });
  });

  test("sanitizes provider and digest failures", async () => {
    const sensitiveValue = "sensitive-provider-value";
    const providerFailure = createSnapshotReadHandler({
      view: () => {
        throw new Error(sensitiveValue);
      },
    });
    const digestFailure = createSnapshotReadHandler(
      provider({
        snapshot: representativeSnapshot(),
        status: workerStatus({ phase: "ready", hasSnapshot: true }),
      }),
      () => {
        throw new Error(sensitiveValue);
      },
    );

    for (const handler of [providerFailure, digestFailure]) {
      const response = handler(new Request(API_URL));
      const body = JSON.stringify(await response.json());
      expect(response.status).toBe(500);
      expect(body).toBe('{"error":{"code":"INTERNAL_READ_FAILURE"}}');
      expect(body).not.toContain(sensitiveValue);
    }
  });
});

function provider(view: SnapshotWorkerView): SnapshotViewProvider {
  return { view: () => view };
}

function workerStatus(
  override: Partial<SnapshotWorkerStatus> = {},
): SnapshotWorkerStatus {
  return {
    phase: "starting",
    attempts: 0,
    consecutiveFailures: 0,
    hasSnapshot: false,
    lastAttemptAt: null,
    lastError: null,
    lastSuccessAt: null,
    nextRefreshAt: null,
    refreshIntervalSeconds: 60,
    retainedAfterFailure: false,
    sourcePartial: false,
    sourceStale: false,
    ...override,
  };
}

function representativeSnapshot(): NormalizedSnapshot {
  return normalizeSnapshot(representative, observationFor(representative));
}

function observationFor(fixture: {
  readonly fixture: {
    readonly observedAt: string;
    readonly upstreamCommit: string;
  };
}): SnapshotObservation {
  return {
    observedAt: fixture.fixture.observedAt,
    playerAddress: PLAYER_ADDRESS,
    upstreamCommit: fixture.fixture.upstreamCommit,
  };
}
