import { describe, expect, test } from "bun:test";

import { SnapshotCollectionError } from "../src/snapshot-collector.ts";
import { normalizeSnapshot } from "../src/snapshot-normalizer.ts";
import {
  DEFAULT_SNAPSHOT_REFRESH_INTERVAL_SECONDS,
  readSnapshotWorkerConfiguration,
  SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR,
  type SnapshotCollector,
  SnapshotWorker,
  SnapshotWorkerConfigurationError,
  type SnapshotWorkerScheduler,
} from "../src/snapshot-worker.ts";
import type { NormalizedSnapshot } from "../src/snapshot.ts";
import partial from "./fixtures/snapshot-source/partial.json" with {
  type: "json",
};
import representative from "./fixtures/snapshot-source/representative.json" with {
  type: "json",
};

const PLAYER_ADDRESS = "0x1111111111111111111111111111111111111111";
const SENSITIVE_FAILURE = "sensitive upstream payload";

class MutableClock {
  #milliseconds = Date.parse("2026-08-20T12:00:00.000Z");

  now = (): Date => new Date(this.#milliseconds);

  advance(milliseconds: number): void {
    this.#milliseconds += milliseconds;
  }
}

interface ScheduledTask {
  readonly callback: () => void;
  readonly delayMilliseconds: number;
  readonly id: number;
}

class FakeScheduler implements SnapshotWorkerScheduler {
  #nextId = 1;
  readonly cleared: number[] = [];
  readonly tasks: ScheduledTask[] = [];

  clear(handle: unknown): void {
    const id = Number(handle);
    this.cleared.push(id);
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index >= 0) this.tasks.splice(index, 1);
  }

  set(callback: () => void, delayMilliseconds: number): unknown {
    const task = { callback, delayMilliseconds, id: this.#nextId++ };
    this.tasks.push(task);
    return task.id;
  }

  runNext(clock: MutableClock): void {
    const task = this.tasks.shift();
    if (!task) throw new Error("Expected a scheduled task");
    clock.advance(task.delayMilliseconds);
    task.callback();
  }
}

class SequenceCollector implements SnapshotCollector {
  readonly calls: string[] = [];
  readonly #results: Array<NormalizedSnapshot | Error>;

  constructor(...results: Array<NormalizedSnapshot | Error>) {
    this.#results = results;
  }

  async collect(playerAddress: string): Promise<NormalizedSnapshot> {
    this.calls.push(playerAddress);
    const result = this.#results.shift();
    if (!result) throw new Error("No synthetic collection result remains");
    if (result instanceof Error) throw result;
    return result;
  }
}

describe("snapshot worker configuration", () => {
  test("uses the one-minute default and accepts a bounded override", () => {
    expect(readSnapshotWorkerConfiguration({})).toEqual({
      refreshIntervalSeconds: DEFAULT_SNAPSHOT_REFRESH_INTERVAL_SECONDS,
    });
    expect(
      readSnapshotWorkerConfiguration({
        [SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR]: "300",
      }),
    ).toEqual({ refreshIntervalSeconds: 300 });
  });

  test.each(["29", "86401", "30.5", "-30", "not-a-number"])(
    "rejects the invalid interval %s without echoing it",
    (interval) => {
      try {
        readSnapshotWorkerConfiguration({
          [SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR]: interval,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(SnapshotWorkerConfigurationError);
        expect(String(error)).not.toContain(interval);
        return;
      }
      throw new Error("Expected worker configuration to fail");
    },
  );
});

describe("snapshot worker", () => {
  test("refreshes immediately and schedules from successful completion", async () => {
    const clock = new MutableClock();
    const scheduler = new FakeScheduler();
    const snapshot = representativeSnapshot();
    const collector = new SequenceCollector(snapshot, snapshot);
    const worker = createWorker(collector, clock, scheduler);

    await worker.start();

    expect(collector.calls).toEqual([PLAYER_ADDRESS]);
    expect(worker.view()).toEqual({
      snapshot,
      status: {
        phase: "ready",
        attempts: 1,
        consecutiveFailures: 0,
        hasSnapshot: true,
        lastAttemptAt: "2026-08-20T12:00:00.000Z",
        lastError: null,
        lastSuccessAt: "2026-08-20T12:00:00.000Z",
        nextRefreshAt: "2026-08-20T12:01:00.000Z",
        refreshIntervalSeconds: 60,
        retainedAfterFailure: false,
        sourcePartial: false,
        sourceStale: false,
      },
    });
    expect(scheduler.tasks).toHaveLength(1);
    expect(scheduler.tasks[0]?.delayMilliseconds).toBe(60_000);

    scheduler.runNext(clock);
    await eventually(() => expect(collector.calls).toHaveLength(2));
    expect(worker.view().status.lastSuccessAt).toBe("2026-08-20T12:01:00.000Z");
  });

  test("deduplicates refreshes while collection is in flight", async () => {
    const clock = new MutableClock();
    const scheduler = new FakeScheduler();
    const deferred = Promise.withResolvers<NormalizedSnapshot>();
    const calls: string[] = [];
    const collector: SnapshotCollector = {
      collect: (address) => {
        calls.push(address);
        return deferred.promise;
      },
    };
    const worker = createWorker(collector, clock, scheduler);

    const initial = worker.start();
    const duplicate = worker.refreshNow();

    expect(calls).toEqual([PLAYER_ADDRESS]);
    expect(initial).toBe(duplicate);
    expect(worker.view().status.phase).toBe("refreshing");
    deferred.resolve(representativeSnapshot());
    await initial;
    expect(scheduler.tasks).toHaveLength(1);
  });

  test("sanitizes a first failure and retries after thirty seconds", async () => {
    const clock = new MutableClock();
    const scheduler = new FakeScheduler();
    const collector = new SequenceCollector(new Error(SENSITIVE_FAILURE));
    const worker = createWorker(collector, clock, scheduler);

    await worker.start();

    expect(worker.view()).toEqual({
      snapshot: null,
      status: {
        phase: "degraded",
        attempts: 1,
        consecutiveFailures: 1,
        hasSnapshot: false,
        lastAttemptAt: "2026-08-20T12:00:00.000Z",
        lastError: {
          code: "UNEXPECTED_COLLECTION_FAILURE",
          occurredAt: "2026-08-20T12:00:00.000Z",
          retryable: true,
          surface: "collector",
        },
        lastSuccessAt: null,
        nextRefreshAt: "2026-08-20T12:00:30.000Z",
        refreshIntervalSeconds: 60,
        retainedAfterFailure: false,
        sourcePartial: false,
        sourceStale: false,
      },
    });
    expect(JSON.stringify(worker.view())).not.toContain(SENSITIVE_FAILURE);
    expect(scheduler.tasks[0]?.delayMilliseconds).toBe(30_000);
  });

  test("retains the latest account snapshot and resets after recovery", async () => {
    const clock = new MutableClock();
    const scheduler = new FakeScheduler();
    const snapshot = representativeSnapshot();
    const recovered = partialSnapshot();
    const failure = new SnapshotCollectionError(
      "API_REQUEST_FAILED",
      "overview",
      { status: 503 },
    );
    const collector = new SequenceCollector(snapshot, failure, recovered);
    const worker = createWorker(collector, clock, scheduler);

    await worker.start();
    scheduler.runNext(clock);
    await eventually(() => expect(worker.view().status.attempts).toBe(2));

    expect(worker.view().snapshot).toBe(snapshot);
    expect(worker.view().status).toMatchObject({
      phase: "degraded",
      consecutiveFailures: 1,
      retainedAfterFailure: true,
      sourcePartial: false,
      sourceStale: false,
      lastError: {
        code: "API_REQUEST_FAILED",
        retryable: true,
        status: 503,
        surface: "overview",
      },
    });
    expect(scheduler.tasks[0]?.delayMilliseconds).toBe(30_000);

    await Promise.resolve();
    scheduler.runNext(clock);
    await eventually(() => expect(worker.view().status.attempts).toBe(3));
    expect(worker.view().snapshot).toBe(recovered);
    expect(worker.view().status).toMatchObject({
      phase: "degraded",
      consecutiveFailures: 0,
      retainedAfterFailure: false,
      sourcePartial: true,
      sourceStale: true,
      lastError: null,
    });
    expect(scheduler.tasks[0]?.delayMilliseconds).toBe(60_000);
  });

  test("honors Retry-After and uses the normal interval for nonretryable failures", async () => {
    const clock = new MutableClock();
    const scheduler = new FakeScheduler();
    const collector = new SequenceCollector(
      new SnapshotCollectionError("API_REQUEST_FAILED", "highscores", {
        retryAfterSeconds: 90,
        status: 429,
      }),
    );
    const worker = createWorker(collector, clock, scheduler);

    await worker.start();
    expect(scheduler.tasks[0]?.delayMilliseconds).toBe(90_000);

    const nonretryableScheduler = new FakeScheduler();
    const nonretryable = createWorker(
      new SequenceCollector(
        new SnapshotCollectionError("UNSUPPORTED_BOOTSTRAP", "runtime-config"),
      ),
      clock,
      nonretryableScheduler,
    );
    await nonretryable.start();
    expect(nonretryableScheduler.tasks[0]?.delayMilliseconds).toBe(60_000);
    expect(nonretryable.view().status.lastError?.retryable).toBe(false);
  });

  test("bounds an untrusted Retry-After to the platform-safe timer range", async () => {
    const clock = new MutableClock();
    const scheduler = new FakeScheduler();
    const collector = new SequenceCollector(
      new SnapshotCollectionError("API_REQUEST_FAILED", "highscores", {
        retryAfterSeconds: Number.MAX_SAFE_INTEGER,
        status: 429,
      }),
    );
    const worker = createWorker(collector, clock, scheduler);

    await worker.start();

    expect(scheduler.tasks[0]?.delayMilliseconds).toBe(2_147_483_000);
    expect(worker.view().status.lastError?.retryAfterSeconds).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  test("stops cleanly and does not schedule after an in-flight stop", async () => {
    const clock = new MutableClock();
    const scheduler = new FakeScheduler();
    const deferred = Promise.withResolvers<NormalizedSnapshot>();
    const worker = createWorker(
      { collect: () => deferred.promise },
      clock,
      scheduler,
    );

    const refresh = worker.start();
    worker.stop();
    deferred.resolve(representativeSnapshot());
    await refresh;

    expect(worker.view().status.phase).toBe("stopped");
    expect(worker.view().status.nextRefreshAt).toBeNull();
    expect(scheduler.tasks).toEqual([]);
    expect(() => worker.refreshNow()).toThrow("Snapshot worker is stopped");
  });
});

function createWorker(
  collector: SnapshotCollector,
  clock: MutableClock,
  scheduler: FakeScheduler,
): SnapshotWorker {
  return new SnapshotWorker({
    clock: clock.now,
    collector,
    playerAddress: PLAYER_ADDRESS,
    refreshIntervalSeconds: 60,
    scheduler,
  });
}

function representativeSnapshot(): NormalizedSnapshot {
  return normalizeSnapshot(representative, {
    observedAt: "2026-08-20T12:00:00.000Z",
    playerAddress: PLAYER_ADDRESS,
    upstreamCommit: representative.runtimeConfig.backend.build.gitSha,
  });
}

function partialSnapshot(): NormalizedSnapshot {
  return normalizeSnapshot(partial, {
    observedAt: "2026-08-20T12:01:30.000Z",
    playerAddress: PLAYER_ADDRESS,
    upstreamCommit: partial.fixture.upstreamCommit,
  });
}

async function eventually(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      if (attempt === 19) throw error;
      await Promise.resolve();
    }
  }
}
