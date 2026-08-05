# Veydrift Operator

Veydrift Operator is a small, open-source companion for understanding Veydrift. The MVP will periodically capture the current public game state, explain the universe and one configured player's place in it, and answer nonpersistent strategy questions through an OpenAI-backed chat interface.

**Veydrift Operator** is the canonical and long-term project name. This first build is deliberately read-only; future operator capabilities may be considered through explicit scope changes, but they are not part of this MVP.

The product is read-only and advisory. Transaction construction, signing, approvals, automation, alerts, Telegram, persistent chat, and multi-user hosting are outside the MVP.

The project is currently in Phase 1: resetting the earlier automation-oriented roadmap around this smaller product. Direction and phase gates live in the [implementation plan](IMPLEMENTATION_PLAN.md). The [deployment manifest](docs/deployment-manifest.md) preserves reviewed live-deployment research, and the [whitepaper research note](docs/research/veydrift-whitepaper.md) preserves labeled economic and game-design context.

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

## Current scaffold note

The code on `main` still contains the earlier local private-key identity scaffold. Until Phase 2 replaces it with a public player-address configuration, starting that scaffold follows the existing synthetic `.env.example` flow:

```sh
bun run start
```

Do not fund that wallet or treat the legacy startup path as an MVP requirement. The read-only product will not require a private key.

Future OpenAI access will use a server-side `OPENAI_API_KEY` from the ignored `.env`. It must never be exposed to browser code, API responses, logs, tests, screenshots, or tracked examples. OpenAI calls are not part of Phase 1.

The application will set `store: false` and will not maintain a server conversation store. That setting disables retrievable Responses application state; it does not promise Zero Data Retention or prevent all provider-side abuse-monitoring and prompt-cache retention. OpenAI's current [API data controls](https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring) apply to transmitted chat content.
