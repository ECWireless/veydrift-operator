import {
  createSnapshotDigest,
  type SnapshotDigest,
} from "./snapshot-digest.ts";
import type { NormalizedSnapshot } from "./snapshot.ts";
import type { SnapshotWorkerView } from "./snapshot-worker.ts";

export const SNAPSHOT_READ_API_PATH = "/api/snapshot";
export const SNAPSHOT_READ_API_VERSION = 1;

export interface SnapshotViewProvider {
  view(): SnapshotWorkerView;
}

export type SnapshotDigestFactory = (
  snapshot: NormalizedSnapshot,
) => SnapshotDigest;

export function createSnapshotReadHandler(
  provider: SnapshotViewProvider,
  digestFactory: SnapshotDigestFactory = createSnapshotDigest,
): (request: Request) => Response {
  const digestCache = new WeakMap<NormalizedSnapshot, SnapshotDigest>();

  return (request) => {
    const url = new URL(request.url);
    if (url.pathname !== SNAPSHOT_READ_API_PATH) {
      return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
    }
    if (request.method !== "GET") {
      return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED" } }, 405, {
        allow: "GET",
      });
    }

    try {
      const view = provider.view();
      const digest =
        view.snapshot === null
          ? null
          : cachedDigest(view.snapshot, digestCache, digestFactory);

      return jsonResponse({
        apiVersion: SNAPSHOT_READ_API_VERSION,
        status: view.status,
        snapshot: view.snapshot,
        digest,
      });
    } catch {
      return jsonResponse({ error: { code: "INTERNAL_READ_FAILURE" } }, 500);
    }
  };
}

function cachedDigest(
  snapshot: NormalizedSnapshot,
  cache: WeakMap<NormalizedSnapshot, SnapshotDigest>,
  digestFactory: SnapshotDigestFactory,
): SnapshotDigest {
  const existing = cache.get(snapshot);
  if (existing !== undefined) return existing;

  const digest = digestFactory(snapshot);
  cache.set(snapshot, digest);
  return digest;
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}
