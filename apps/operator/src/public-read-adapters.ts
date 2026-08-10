export interface PublicApiReadResult {
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
}

export interface PublicApiAdapter {
  get(path: string): Promise<PublicApiReadResult>;
}

export interface PublicRpcAdapter {
  getChainId(): Promise<unknown>;
  getFinalizedBlock(): Promise<unknown>;
}

export type PublicReadTransportErrorCode =
  | "API_HTTP_ERROR"
  | "API_INVALID_JSON"
  | "API_REQUEST_FAILED"
  | "INVALID_TRANSPORT_URL"
  | "RPC_HTTP_ERROR"
  | "RPC_INVALID_JSON"
  | "RPC_REMOTE_ERROR"
  | "RPC_REQUEST_FAILED";

export class PublicReadTransportError extends Error {
  readonly code: PublicReadTransportErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: PublicReadTransportErrorCode,
    options: {
      readonly retryAfterSeconds?: number;
      readonly status?: number;
    } = {},
  ) {
    super("Public read transport failed");
    this.name = "PublicReadTransportError";
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

type FetchImplementation = typeof fetch;

export class FetchPublicApiAdapter implements PublicApiAdapter {
  readonly #baseUrl: URL;
  readonly #fetch: FetchImplementation;

  constructor(
    baseUrl: string,
    fetchImplementation: FetchImplementation = fetch,
  ) {
    this.#baseUrl = parseHttpsBaseUrl(baseUrl);
    this.#fetch = fetchImplementation;
  }

  async get(path: string): Promise<PublicApiReadResult> {
    const url = resolvePublicPath(this.#baseUrl, path);
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
      });
    } catch (error) {
      if (error instanceof PublicReadTransportError) throw error;
      throw new PublicReadTransportError("API_REQUEST_FAILED");
    }

    if (!response.ok) {
      const retryAfterSeconds = parseRetryAfter(
        response.headers.get("retry-after"),
      );
      throw new PublicReadTransportError("API_HTTP_ERROR", {
        status: response.status,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PublicReadTransportError("API_INVALID_JSON", {
        status: response.status,
      });
    }

    return {
      body,
      headers: Object.freeze(Object.fromEntries(response.headers.entries())),
    };
  }
}

export class FetchPublicRpcAdapter implements PublicRpcAdapter {
  readonly #fetch: FetchImplementation;
  readonly #rpcUrl: URL;
  #requestId = 0;

  constructor(
    rpcUrl: string,
    fetchImplementation: FetchImplementation = fetch,
  ) {
    this.#rpcUrl = parseHttpsBaseUrl(rpcUrl);
    this.#fetch = fetchImplementation;
  }

  getChainId(): Promise<unknown> {
    return this.#request("eth_chainId", []);
  }

  getFinalizedBlock(): Promise<unknown> {
    return this.#request("eth_getBlockByNumber", ["finalized", false]);
  }

  async #request(
    method: "eth_chainId" | "eth_getBlockByNumber",
    params: readonly unknown[],
  ): Promise<unknown> {
    const id = ++this.#requestId;
    let response: Response;
    try {
      response = await this.#fetch(this.#rpcUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
      });
    } catch (error) {
      if (error instanceof PublicReadTransportError) throw error;
      throw new PublicReadTransportError("RPC_REQUEST_FAILED");
    }

    if (!response.ok) {
      throw new PublicReadTransportError("RPC_HTTP_ERROR", {
        status: response.status,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new PublicReadTransportError("RPC_INVALID_JSON", {
        status: response.status,
      });
    }

    if (typeof payload !== "object" || payload === null) {
      throw new PublicReadTransportError("RPC_INVALID_JSON", {
        status: response.status,
      });
    }

    const envelope = payload as Readonly<Record<string, unknown>>;
    if (envelope.error !== undefined) {
      throw new PublicReadTransportError("RPC_REMOTE_ERROR", {
        status: response.status,
      });
    }
    if (
      envelope.jsonrpc !== "2.0" ||
      envelope.id !== id ||
      !("result" in envelope)
    ) {
      throw new PublicReadTransportError("RPC_INVALID_JSON", {
        status: response.status,
      });
    }

    return envelope.result;
  }
}

function parseHttpsBaseUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      throw new Error("Unsupported URL");
    }
    return url;
  } catch {
    throw new PublicReadTransportError("INVALID_TRANSPORT_URL");
  }
}

function resolvePublicPath(baseUrl: URL, path: string): URL {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new PublicReadTransportError("INVALID_TRANSPORT_URL");
  }

  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl.origin) {
    throw new PublicReadTransportError("INVALID_TRANSPORT_URL");
  }
  return url;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || !/^(0|[1-9][0-9]*)$/.test(value)) return undefined;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}
