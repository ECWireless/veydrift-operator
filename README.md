# Veydrift Operator

Veydrift Operator is an open-source, self-hosted assistant for observing Veydrift, explaining strategic choices, and eventually executing explicitly bounded actions.

The project is currently in Phase 0: scaffold and deployment discovery. It must not fund the operator wallet or claim a first planet until the Phase 0 exit gate passes and those actions receive separate approval.

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

Start the current operator scaffold:

```sh
bun run start
```

Real credentials belong only in the ignored `.env`. Keep tracked examples synthetic and never commit private keys, bot tokens, RPC credentials, or chat identifiers.

Dependency installation and verification commands disable Bun's automatic `.env` loading. Runtime commands will intentionally load validated local configuration in later phases.
