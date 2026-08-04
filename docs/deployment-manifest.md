# Supported Deployment Manifest

## Purpose

The supported deployment manifest is the operator's reviewed trust anchor for a specific Veydrift deployment. It records immutable identity and provenance; it does not discover the live deployment, make network requests, authorize actions, or decide whether a mismatch is safe.

The typed schema and parser live in `apps/operator/src/deployment-manifest.ts`. The currently supported identity lives in `apps/operator/src/supported-deployment.ts`. Parsing rejects unknown fields, normalizes valid EVM addresses to checksum form, enforces cross-field invariants, and deeply freezes the result.

Runtime compatibility enforcement belongs to Phase 0 Unit 4. Until that gate exists, importing the manifest does not establish that the current live deployment still matches it.

## Current Identity

The manifest was verified on 2026-08-04 against the block returned by Base RPC's `finalized` tag: block `49,533,868` (`0x0f19fea69ce7686b52407114a0b4253d397e67286da6e23f1e5ed1d3482e87c8`). The manifest records `finality: "finalized"` so a future verifier cannot mistake latest-head evidence for this trust anchor.

| Surface | Pinned identity | Status |
| --- | --- | --- |
| Chain | Base mainnet, chain ID `8453` | Required core |
| Game proxy | `0xf397910F005151b09644228573a4353818D3755d` | Required core |
| Game implementation | `0xffC01680Ae10698eCF14aFFD63da195366d65873` from the EIP-1967 implementation slot | Required core |
| Deployment artifact | commit `701bed3578cff4d134657c714c599dbdb55a4b6a`, ABI `sha256:62cdedb794d4aa11cce1e9ef61e26f12227ce40a3bf47dd6156db6dc5676bc99` | Required core |
| Backend build | commit `30d904defb684f528cbefc55ac14f87b0cce3331`, source `VEYDRIFT_BUILD_ARTIFACT` | Pinned service evidence |
| Resource tokens | vMETAL, vCRYSTAL, and vDEUT proxies and their EIP-1967 implementations, with code present and 6-decimal token calls verified | Supported optional capability |
| Rift | No dedicated live selector and state-semantics verification in this unit | Disabled optional capability |
| Market | No verified production market contract surface in the runtime | Disabled optional capability |

Resource-token support does not activate trading, transfers, withdrawals, Rift extraction, or any other transaction path. It records only the independently observed contract identities and public token metadata. The whitepaper's internal-unit conversion remains research context and is deliberately not encoded as verified deployment behavior.

## Evidence And Hash Definitions

The manifest reconciles four source classes:

1. The production runtime configuration and health endpoints reported the chain, game and resource-token addresses, deployment commit and timestamp, ABI hash, backend build, API base, GraphQL endpoint, and their own endpoint health.
2. Read-only calls to `https://mainnet.base.org` resolved the `finalized` tag, confirmed chain ID `8453`, and then used that exact hex block number for every EIP-1967 implementation-slot, bytecode, token `symbol()`, and token `decimals()` read.
3. The upstream repository at the deployment commit supplied the deployment-manifest hash procedure and the code provenance associated with the reported deployment artifact.
4. The stats URL came from the canonical link in `apps/stats/index.html` at upstream commit `30d904defb684f528cbefc55ac14f87b0cce3331`, then a live HTTPS fetch confirmed that `https://stats.veydrift.com/` returned the same canonical link. The runtime and health payloads do not report this URL, so the manifest records this provenance separately.

`codeKeccak256` is `keccak256` over the exact byte sequence returned by `eth_getCode` at the verification block. `codeBytes` is the byte length of that hex result after removing the `0x` prefix: `(hex.length - 2) / 2`. `abiSha256` uses the upstream deployment-manifest convention: SHA-256 over compact `JSON.stringify` output of the ABI array. The production backend reports this ABI hash; the generated Forge artifact is not committed upstream, so this unit records the official build value rather than claiming an independent artifact rebuild.

Research provenance is separate from deployment identity. The upstream research commit and the maintained whitepaper note can guide later interpretation, but neither can override verified contract code or runtime identity.

## Updating The Manifest

Treat any update as a deployment trust change:

1. Read the production runtime configuration and health metadata without sending a player wallet address.
2. Pin one finalized Base block and verify the chain ID, game proxy code, EIP-1967 implementation address and code, and any optional contract identities using read-only RPC calls.
3. Reconcile the deployment commit and ABI hash with the exact upstream deployment artifact. Record any inability to reproduce an artifact hash rather than weakening the check.
4. Verify each optional capability independently. Leave it disabled when evidence is missing, stale, inconsistent, or only planned upstream.
5. Update the immutable manifest, provenance document, and deterministic tests in one reviewed change.
6. Run the frozen dependency install and complete repository check, then obtain the independent correctness and security reviews required for deployment trust changes.

Do not update the manifest merely to silence a future compatibility failure. Investigate the deployment difference first, and never use this process to sign, submit, fund, claim, trade, or otherwise mutate game or wallet state.
