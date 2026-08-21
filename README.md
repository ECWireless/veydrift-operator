# Veydrift Operator

Veydrift Operator is a small, open-source companion for understanding Veydrift. The MVP will periodically capture the current public game state, explain the universe and one configured player's place in it, and answer nonpersistent strategy questions through an OpenAI-backed chat interface.

**Veydrift Operator** is the canonical and long-term project name. This first build is deliberately read-only; future operator capabilities may be considered through explicit scope changes, but they are not part of this MVP.

The product is read-only and advisory. Transaction construction, signing, approvals, automation, alerts, Telegram, persistent chat, and multi-user hosting are outside the MVP.

The project is currently in Phase 2: building the read-only snapshot worker and measuring whether historical retention is useful. Direction, delivery units, and phase gates live in the [implementation plan](IMPLEMENTATION_PLAN.md). The [snapshot source contract](docs/research/veydrift-snapshot-sources.md) records the verified public read surfaces and freshness contract, the [deployment manifest](docs/deployment-manifest.md) preserves immutable deployment research, and the [whitepaper research note](docs/research/veydrift-whitepaper.md) preserves labeled economic and game-design context.

## Planned MVP

1. A Bun worker refreshes one normalized snapshot immediately at startup and on a configurable interval.
2. A React dashboard presents the universe, the configured player, snapshot freshness, and a cached narrative.
3. A server-side OpenAI boundary answers strategy questions using verified game context, deterministic derived facts, and the latest snapshot.
4. The application keeps chat turns only in browser memory and clears them on reload; each request still transmits the needed turns to OpenAI.

Historical snapshot retention is deliberately undecided. Phase 2 will measure real serialized and compressed snapshot sizes, project storage at useful intervals, and test whether history materially improves narrative and strategy answers before selecting any datastore.

## Prerequisites

- Bun 1.3.14

## Local development

Install the exact dependency graph from the committed lockfile:

```sh
bun --no-env-file ci
```

Run the complete local verification baseline:

```sh
bun --no-env-file run check
```

Individual commands are also available:

```sh
bun --no-env-file run format:check
bun --no-env-file run lint
bun --no-env-file run typecheck
bun --no-env-file run test
bun --no-env-file run build
```

## Current startup configuration

Copy the synthetic public player-address setting from `.env.example` into the ignored `.env`, replace it with the player to observe, and start the operator:

```sh
bun run start
```

The player address is normalized to its EIP-55 checksum before use. A missing, zero, malformed, or incorrectly checksummed mixed-case address prevents startup with a sanitized error.

Snapshot refresh defaults to 60 seconds. Set `VEYDRIFT_SNAPSHOT_INTERVAL_SECONDS` to an integer from 30 through 86400 to override it. The worker refreshes immediately when started, never overlaps collections, and retains the last successful snapshot when a later refresh fails.

The operator binds only to `127.0.0.1` and defaults to port `3000`; set `VEYDRIFT_OPERATOR_PORT` to an integer from 1 through 65535 to choose another local port. Starting the operator immediately begins read-only collection from the verified public Veydrift API and Base RPC. `GET /api/snapshot` returns API version 1, collection status, the latest normalized snapshot, and its matching analysis digest with `Cache-Control: no-store`. Before the first successful refresh, both snapshot fields are `null` and the status explains the pending or failed collection. The API has no refresh, transaction, signing, or other mutation endpoint.

Each normalized snapshot can also produce a versioned, deeply immutable analysis digest. It starts with the home planet, retains every owned colony, compacts the collected universe view, carries freshness and unavailable-input evidence, and labels its aggregate resources, production, queues, missions, combat power, and score gap as deterministic calculations. The digest includes the advisory objective profile and marks all game-originated text as untrusted data; it does not contain model output.

The Phase 2 snapshot runtime does not read `VEYDRIFT_OPERATOR_PRIVATE_KEY`. Any copy already present in the ignored local `.env` remains local and untouched; signing functionality requires an explicit future scope change and security design.

Future OpenAI access will use a server-side `OPENAI_API_KEY` from the ignored `.env`. It must never be exposed to browser code, API responses, logs, tests, screenshots, or tracked examples. OpenAI calls are not part of Phase 2.

The application will set `store: false` and will not maintain a server conversation store. That setting disables retrievable Responses application state; it does not promise Zero Data Retention or prevent all provider-side abuse-monitoring and prompt-cache retention. OpenAI's current [API data controls](https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring) apply to transmitted chat content.
