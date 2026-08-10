import { describe, expect, test } from "bun:test";

import {
  FetchPublicApiAdapter,
  FetchPublicRpcAdapter,
  PublicReadTransportError,
} from "../src/public-read-adapters.ts";

type FetchCall = {
  readonly input: Parameters<typeof fetch>[0];
  readonly init?: RequestInit;
};

function memoryFetch(
  responses: readonly Response[],
  calls: FetchCall[],
): typeof fetch {
  let index = 0;
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ input, ...(init === undefined ? {} : { init }) });
    const response = responses[index++];
    if (response === undefined) throw new Error("Missing fake fetch response");
    return response;
  }) as typeof fetch;
}

function expectTransportError(
  operation: Promise<unknown>,
): Promise<PublicReadTransportError> {
  return operation.then(
    () => {
      throw new Error("Expected public transport to fail");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(PublicReadTransportError);
      return error as PublicReadTransportError;
    },
  );
}

describe("fetch public API adapter", () => {
  test("performs an unauthenticated public GET and captures headers", async () => {
    const calls: FetchCall[] = [];
    const adapter = new FetchPublicApiAdapter(
      "https://api.veydrift.com",
      memoryFetch(
        [
          Response.json(
            { ok: true },
            {
              headers: {
                "cache-control": "no-store",
                "x-veydrift-index-state": "healthy",
              },
            },
          ),
        ],
        calls,
      ),
    );

    const result = await adapter.get("/runtime-config");

    expect(result.body).toEqual({ ok: true });
    expect(result.headers).toMatchObject({
      "cache-control": "no-store",
      "x-veydrift-index-state": "healthy",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input.toString()).toBe(
      "https://api.veydrift.com/runtime-config",
    );
    expect(calls[0]?.init).toMatchObject({
      method: "GET",
      credentials: "omit",
      redirect: "error",
    });
    expect(new Headers(calls[0]?.init?.headers).has("authorization")).toBe(
      false,
    );
    expect(new Headers(calls[0]?.init?.headers).has("cookie")).toBe(false);
  });

  test("preserves bounded 429 evidence without reading the response body", async () => {
    const calls: FetchCall[] = [];
    const adapter = new FetchPublicApiAdapter(
      "https://api.veydrift.com",
      memoryFetch(
        [
          new Response("untrusted error body", {
            status: 429,
            headers: { "retry-after": "10" },
          }),
        ],
        calls,
      ),
    );

    const error = await expectTransportError(adapter.get("/highscores"));

    expect(error).toMatchObject({
      code: "API_HTTP_ERROR",
      status: 429,
      retryAfterSeconds: 10,
    });
    expect(error.message).not.toContain("untrusted error body");
  });

  test("rejects non-HTTPS bases and origin-changing paths", async () => {
    expect(() => new FetchPublicApiAdapter("http://api.veydrift.com")).toThrow(
      PublicReadTransportError,
    );

    const adapter = new FetchPublicApiAdapter(
      "https://api.veydrift.com",
      memoryFetch([], []),
    );
    const error = await expectTransportError(adapter.get("//example.com/data"));
    expect(error.code).toBe("INVALID_TRANSPORT_URL");
  });
});

describe("fetch public RPC adapter", () => {
  test("exposes only the approved chain and finalized-block reads", async () => {
    const calls: FetchCall[] = [];
    const adapter = new FetchPublicRpcAdapter(
      "https://mainnet.base.org",
      memoryFetch(
        [
          Response.json({ jsonrpc: "2.0", id: 1, result: "0x2105" }),
          Response.json({
            jsonrpc: "2.0",
            id: 2,
            result: {
              number: "0x2f7c9a0",
              hash: `0x${"b".repeat(64)}`,
              timestamp: "0x6a79f023",
            },
          }),
        ],
        calls,
      ),
    );

    expect(await adapter.getChainId()).toBe("0x2105");
    expect(await adapter.getFinalizedBlock()).toMatchObject({
      number: "0x2f7c9a0",
    });
    expect(calls).toHaveLength(2);
    const bodies = calls.map(
      (call) => JSON.parse(String(call.init?.body)) as Record<string, unknown>,
    );
    expect(bodies).toEqual([
      { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getBlockByNumber",
        params: ["finalized", false],
      },
    ]);
    for (const call of calls) {
      expect(call.input.toString()).toBe("https://mainnet.base.org/");
      expect(call.init).toMatchObject({
        method: "POST",
        credentials: "omit",
        redirect: "error",
      });
      expect(new Headers(call.init?.headers).has("authorization")).toBe(false);
    }
  });

  test("sanitizes JSON-RPC error payloads", async () => {
    const adapter = new FetchPublicRpcAdapter(
      "https://mainnet.base.org",
      memoryFetch(
        [
          Response.json({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32_000, message: "untrusted rpc error" },
          }),
        ],
        [],
      ),
    );

    const error = await expectTransportError(adapter.getChainId());

    expect(error.code).toBe("RPC_REMOTE_ERROR");
    expect(error.message).not.toContain("untrusted rpc error");
  });
});
