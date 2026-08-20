import type { Address } from "viem";

import {
  type SnapshotCollectionErrorCode,
  SnapshotCollectionError,
} from "./snapshot-collector.ts";
import type { NormalizedSnapshot } from "./snapshot.ts";

export const SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR =
  "VEYDRIFT_SNAPSHOT_INTERVAL_SECONDS";
export const DEFAULT_SNAPSHOT_REFRESH_INTERVAL_SECONDS = 60;
export const MIN_SNAPSHOT_REFRESH_INTERVAL_SECONDS = 30;
export const MAX_SNAPSHOT_REFRESH_INTERVAL_SECONDS = 86_400;

const FIRST_RETRY_DELAY_SECONDS = 30;
const MAX_TIMER_DELAY_SECONDS = Math.floor(2_147_483_647 / 1_000);

export interface SnapshotCollector {
  collect(playerAddress: Address | string): Promise<NormalizedSnapshot>;
}

export interface SnapshotWorkerScheduler {
  clear(handle: unknown): void;
  set(callback: () => void, delayMilliseconds: number): unknown;
}

export interface SnapshotWorkerOptions {
  readonly clock?: () => Date;
  readonly collector: SnapshotCollector;
  readonly playerAddress: Address;
  readonly refreshIntervalSeconds?: number;
  readonly scheduler?: SnapshotWorkerScheduler;
}

export interface SnapshotWorkerConfiguration {
  readonly refreshIntervalSeconds: number;
}

export type SnapshotWorkerPhase =
  | "degraded"
  | "ready"
  | "refreshing"
  | "starting"
  | "stopped";

export type SnapshotWorkerErrorCode =
  | SnapshotCollectionErrorCode
  | "UNEXPECTED_COLLECTION_FAILURE";

export interface SnapshotWorkerError {
  readonly code: SnapshotWorkerErrorCode;
  readonly occurredAt: string;
  readonly retryable: boolean;
  readonly surface: string;
  readonly retryAfterSeconds?: number;
  readonly status?: number;
}

export interface SnapshotWorkerStatus {
  readonly phase: SnapshotWorkerPhase;
  readonly attempts: number;
  readonly consecutiveFailures: number;
  readonly hasSnapshot: boolean;
  readonly lastAttemptAt: string | null;
  readonly lastError: SnapshotWorkerError | null;
  readonly lastSuccessAt: string | null;
  readonly nextRefreshAt: string | null;
  readonly refreshIntervalSeconds: number;
  readonly retainedAfterFailure: boolean;
  readonly sourcePartial: boolean;
  readonly sourceStale: boolean;
}

export interface SnapshotWorkerView {
  readonly snapshot: NormalizedSnapshot | null;
  readonly status: SnapshotWorkerStatus;
}

export class SnapshotWorkerConfigurationError extends Error {
  constructor() {
    super(
      `${SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR} must be an integer from ${MIN_SNAPSHOT_REFRESH_INTERVAL_SECONDS} to ${MAX_SNAPSHOT_REFRESH_INTERVAL_SECONDS}`,
    );
    this.name = "SnapshotWorkerConfigurationError";
  }
}

export class SnapshotWorker {
  readonly #clock: () => Date;
  readonly #collector: SnapshotCollector;
  readonly #playerAddress: Address;
  readonly #refreshIntervalSeconds: number;
  readonly #scheduler: SnapshotWorkerScheduler;

  #active = false;
  #attempts = 0;
  #consecutiveFailures = 0;
  #inFlight: Promise<void> | null = null;
  #lastAttemptAt: string | null = null;
  #lastError: SnapshotWorkerError | null = null;
  #lastSuccessAt: string | null = null;
  #nextRefreshAt: string | null = null;
  #phase: SnapshotWorkerPhase = "starting";
  #snapshot: NormalizedSnapshot | null = null;
  #stopped = false;
  #timer: unknown | null = null;

  constructor(options: SnapshotWorkerOptions) {
    this.#collector = options.collector;
    this.#playerAddress = options.playerAddress;
    this.#clock = options.clock ?? (() => new Date());
    this.#scheduler = options.scheduler ?? systemScheduler;
    this.#refreshIntervalSeconds = validateRefreshInterval(
      options.refreshIntervalSeconds ??
        DEFAULT_SNAPSHOT_REFRESH_INTERVAL_SECONDS,
    );
  }

  start(): Promise<void> {
    if (this.#stopped) {
      throw new Error("Snapshot worker cannot restart after it is stopped");
    }
    this.#active = true;
    return this.refreshNow();
  }

  refreshNow(): Promise<void> {
    if (this.#stopped) {
      throw new Error("Snapshot worker is stopped");
    }
    if (this.#inFlight !== null) return this.#inFlight;

    this.#clearTimer();
    const refresh = this.#refresh();
    this.#inFlight = refresh;
    const clearInFlight = () => {
      if (this.#inFlight === refresh) this.#inFlight = null;
    };
    void refresh.then(clearInFlight, clearInFlight);
    return refresh;
  }

  stop(): void {
    this.#active = false;
    this.#stopped = true;
    this.#clearTimer();
    this.#phase = "stopped";
  }

  view(): SnapshotWorkerView {
    return Object.freeze({
      snapshot: this.#snapshot,
      status: this.#status(),
    });
  }

  async #refresh(): Promise<void> {
    this.#phase = "refreshing";
    this.#attempts += 1;
    this.#lastAttemptAt = this.#nowIso();

    try {
      const snapshot = await this.#collector.collect(this.#playerAddress);
      this.#snapshot = snapshot;
      this.#lastSuccessAt = this.#nowIso();
      this.#lastError = null;
      this.#consecutiveFailures = 0;
      if (!this.#stopped) {
        this.#phase = snapshotIsDegraded(snapshot) ? "degraded" : "ready";
      }
    } catch (error) {
      this.#consecutiveFailures += 1;
      this.#lastError = sanitizeCollectionError(error, this.#nowIso());
      if (!this.#stopped) this.#phase = "degraded";
    } finally {
      if (this.#active && !this.#stopped) this.#scheduleNextRefresh();
    }
  }

  #scheduleNextRefresh(): void {
    const delaySeconds = this.#nextDelaySeconds();
    const scheduledAt = this.#clock().getTime() + delaySeconds * 1_000;
    this.#nextRefreshAt = new Date(scheduledAt).toISOString();
    this.#timer = this.#scheduler.set(() => {
      this.#timer = null;
      this.#nextRefreshAt = null;
      void this.refreshNow();
    }, delaySeconds * 1_000);
  }

  #nextDelaySeconds(): number {
    if (this.#lastError === null || !this.#lastError.retryable) {
      return this.#refreshIntervalSeconds;
    }

    const exponent = Math.max(0, this.#consecutiveFailures - 1);
    const backoffSeconds = Math.min(
      this.#refreshIntervalSeconds,
      FIRST_RETRY_DELAY_SECONDS * 2 ** exponent,
    );
    return Math.min(
      MAX_TIMER_DELAY_SECONDS,
      Math.max(backoffSeconds, this.#lastError.retryAfterSeconds ?? 0),
    );
  }

  #clearTimer(): void {
    if (this.#timer !== null) {
      this.#scheduler.clear(this.#timer);
      this.#timer = null;
    }
    this.#nextRefreshAt = null;
  }

  #status(): SnapshotWorkerStatus {
    const sourcePartial = this.#snapshot?.status.completeness === "partial";
    const sourceStale = this.#snapshot?.status.stale === true;
    return Object.freeze({
      phase: this.#phase,
      attempts: this.#attempts,
      consecutiveFailures: this.#consecutiveFailures,
      hasSnapshot: this.#snapshot !== null,
      lastAttemptAt: this.#lastAttemptAt,
      lastError: this.#lastError,
      lastSuccessAt: this.#lastSuccessAt,
      nextRefreshAt: this.#nextRefreshAt,
      refreshIntervalSeconds: this.#refreshIntervalSeconds,
      retainedAfterFailure: this.#snapshot !== null && this.#lastError !== null,
      sourcePartial,
      sourceStale,
    });
  }

  #nowIso(): string {
    return this.#clock().toISOString();
  }
}

export function readSnapshotWorkerConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): SnapshotWorkerConfiguration {
  const rawInterval = environment[SNAPSHOT_REFRESH_INTERVAL_SECONDS_ENV_VAR];
  if (rawInterval === undefined || rawInterval.trim() === "") {
    return Object.freeze({
      refreshIntervalSeconds: DEFAULT_SNAPSHOT_REFRESH_INTERVAL_SECONDS,
    });
  }
  if (!/^[0-9]+$/.test(rawInterval)) {
    throw new SnapshotWorkerConfigurationError();
  }
  return Object.freeze({
    refreshIntervalSeconds: validateRefreshInterval(Number(rawInterval)),
  });
}

function validateRefreshInterval(value: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < MIN_SNAPSHOT_REFRESH_INTERVAL_SECONDS ||
    value > MAX_SNAPSHOT_REFRESH_INTERVAL_SECONDS
  ) {
    throw new SnapshotWorkerConfigurationError();
  }
  return value;
}

function snapshotIsDegraded(snapshot: NormalizedSnapshot): boolean {
  return snapshot.status.completeness === "partial" || snapshot.status.stale;
}

function sanitizeCollectionError(
  error: unknown,
  occurredAt: string,
): SnapshotWorkerError {
  if (error instanceof SnapshotCollectionError) {
    return Object.freeze({
      code: error.code,
      occurredAt,
      retryable: isRetryableCollectionError(error.code),
      surface: error.surface,
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
      ...(error.status === undefined ? {} : { status: error.status }),
    });
  }
  return Object.freeze({
    code: "UNEXPECTED_COLLECTION_FAILURE",
    occurredAt,
    retryable: true,
    surface: "collector",
  });
}

function isRetryableCollectionError(
  code: SnapshotCollectionErrorCode,
): boolean {
  switch (code) {
    case "INVALID_PLAYER_ADDRESS":
    case "UNSUPPORTED_BOOTSTRAP":
      return false;
    case "API_REQUEST_FAILED":
    case "INVALID_OVERVIEW":
    case "INVALID_SOURCE_BATCH":
    case "PRIMARY_PLANET_INCONSISTENT":
    case "RPC_REQUEST_FAILED":
      return true;
  }
}

const systemScheduler: SnapshotWorkerScheduler = {
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  set: (callback, delayMilliseconds) => setTimeout(callback, delayMilliseconds),
};
