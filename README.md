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

Dependency installation and verification commands disable Bun's automatic `.env` loading. Runtime commands intentionally load validated local configuration.

## Local operator identity

Copy `.env.example` to the ignored `.env` and replace the intentionally invalid private-key placeholder locally. The operator requires a `0x`-prefixed, 32-byte secp256k1 private key in `VEYDRIFT_OPERATOR_PRIVATE_KEY`.

At startup, the operator validates that value and reports only its derived, checksummed public wallet address. The private key is not returned from the identity boundary or included in configuration errors.

The public operator address establishes the canonical player-wallet identity, but it is not proof of dashboard access. A future remotely accessible dashboard must authenticate a human through a fresh signed challenge or a separate controller identity. The operator private key must never be sent to a browser or used by the server to authenticate itself as the user.
