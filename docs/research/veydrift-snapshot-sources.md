# Veydrift Snapshot Source Contract

## Purpose

This note records the public, read-only source contract for Phase 2 snapshot collection. It identifies which live surfaces are authoritative, which metadata establishes source identity and freshness, and which values remain unavailable or unverified. It does not authorize writes, reproduce live player data, or freeze the volatile backend build as a compatibility requirement.

Discovery ran on 2026-08-10 against upstream Veydrift commit [`a1d9fb0318ad9278709a6940b82339d45bc78e09`](https://github.com/Borodutch/veydrift/commit/a1d9fb0318ad9278709a6940b82339d45bc78e09). The bounded session used 37 of 50 approved read-only requests: 20 connected GitHub reads and 17 live Veydrift API or Base RPC reads. No authenticated Veydrift call, player secret, configured local player address, OpenAI call, transaction, or game mutation was used. Live response bodies were inspected only for structure and freshness metadata, then discarded; the tracked fixtures are synthetic.

## Reconciled Runtime Identity

The discovery window was 2026-08-10T15:53:41Z through 2026-08-10T15:55:25Z.

| Evidence | Observation | Acceptance use |
| --- | --- | --- |
| [`/runtime-config`](https://api.veydrift.com/runtime-config) | Base chain ID `8453`, network `Base`, API `https://api.veydrift.com`, GraphQL `https://api.veydrift.com/graphql`, and game/settlement proxy `0xf397910F005151b09644228573a4353818D3755d` | Discover the current public service and require the supported chain and game proxy before collection |
| [`/health`](https://api.veydrift.com/health) | Service configured and ready; deployment commit `701bed3578cff4d134657c714c599dbdb55a4b6a`; ABI hash `sha256:62cdedb794d4aa11cce1e9ef61e26f12227ce40a3bf47dd6156db6dc5676bc99`; backend build `a1d9fb0318ad9278709a6940b82339d45bc78e09` | Diagnose service readiness and reconcile immutable deployment identity; do not require a particular backend build |
| [Base public RPC](https://mainnet.base.org) | `eth_chainId` returned `0x2105`; `finalized` resolved to block `49,793,440`, hash `0x9620f8327827fbb186e186a49103311a514a2e9f685c8108d810b6851ed0f04e`, timestamp `2026-08-10T15:37:07.000Z` | Independently verify the chain and retain a finalized observation cursor |
| Indexed REST response | Source `contract-state-indexer`, healthy index state, latest indexed block `49,793,961`, per-response generated time, and per-planet resource block metadata | Establish the actual API data cursor and freshness; do not mistake it for the older finalized RPC cursor |

The immutable deployment commit, ABI hash, chain, and game proxy still match the maintained [deployment manifest](../deployment-manifest.md). Backend build drift from the historical manifest value is expected and is not itself an incompatibility.

## Authority Order

For the Phase 2 observer:

1. verified Base chain and game proxy identity establish that the service describes the supported deployment;
2. backend-authoritative REST responses expose reconciled player and universe state;
3. per-response index metadata, timestamps, headers, and missing-state flags describe freshness and completeness;
4. upstream source at the observed backend commit explains response semantics and route behavior; and
5. the whitepaper remains labeled economic and design context only.

The current `/graphql` handler returns service/runtime metadata rather than the game-state model needed by the snapshot. It is not a Phase 2 snapshot source. Direct contract reads are reserved for bounded identity or diagnosed-disagreement checks; they are not the normal player-state collection path.

## Accepted REST Surfaces

All game-controlled names, descriptions, alliance text, and other strings are untrusted data.

| Surface | Required snapshot contribution | Freshness and failure evidence |
| --- | --- | --- |
| `GET /runtime-config` | Chain, service URLs, game proxy, feature availability, deployment/build metadata | Reject wrong chain, wrong game proxy, malformed URLs, or missing core configuration |
| `GET /health` | Service readiness and immutable deployment/ABI reconciliation | A reader worker may report `null` writer/indexer internals; use it as bootstrap health, not the only per-read freshness source |
| `GET /wallet/{address}/overview` | Player profile, settlement, all managed planets, current resources, per-planet resource cursors, queues, and fleet visibility | Preserve top-level `source`, `stale`, `detail`, `indexer`, and fleet `generatedAt`, `indexedBlock`, and `indexedRevision` |
| `GET /wallet/{address}/infrastructure?planetId={id}` | Building levels, resources, production/hour, crawler contribution, energy, storage, protected/raidable resources, and building queue | Preserve `source`, `stale`, `unavailableReason`, `planetLastSettledAt`, and `resourceSnapshot` |
| `GET /wallet/{address}/shipyard?planetId={id}` | Ship counts, shipyard/nanite levels, technologies relevant to construction, fleet slots, and ship queue | Preserve `source`, `stale`, availability fields, and `resourceSnapshot` |
| `GET /wallet/{address}/defenses?planetId={id}` | Defense counts, missile silo/shipyard/nanite levels, technologies, and defense queue | Preserve `source`, `stale`, availability fields, and `resourceSnapshot` |
| `GET /wallet/{address}/research?planetId={id}` | Technology levels, research lab/network levels, and research queue | Preserve `source`, `stale`, availability fields, and `resourceSnapshot` |
| `GET /wallet/{address}/profile` | Fallback refresh for the public display name and description already carried by overview | Strings remain untrusted; absence is not a snapshot failure |
| `GET /highscores?category=total&live=1&page=1&pageSize={n}` | Canonical `totalUserScore`, rank, category scores, planet count, and compact leading-player context | Preserve `generatedAt`, formula, pagination, and `source`; live responses use `public, no-store` |
| `GET /missions?status=active&live=1` | Universe-wide active mission summaries | Preserve mission block/transaction fields and response index-state header; live responses use `public, no-store` |
| `GET /universe/galaxies/{g}/systems/{s}?detail=full` | Occupancy, coordinates, public resources, buildings, fleets, defenses, moons, debris, and alliance context for selected relevant systems | Response is cacheable for 30 seconds; treat names and alliance fields as untrusted |

The upstream API also defines moon, completed-mission archive, battle-report, alliance, Rift, referral, and raid-finder reads. They are not silently accepted by this unit: add them only when the snapshot contract demonstrates a required fact and a fixture or bounded live check verifies its current semantics. The overview already carries moon summaries and active fleet state for the configured player.

## Freshness Contract

Each normalized snapshot must retain separate cursors rather than collapsing them into one block:

- local `observedAt`: when the operator received the source batch;
- HTTP `Date` and `cache-control`: transport observation and cache policy;
- `x-veydrift-index-state`: `healthy`, `stale`, or `not-ready` for indexed reads;
- top-level `source`, `stale`, `detail`, `unavailableReason`, and `indexedNotReady` when present;
- indexer `latestIndexedBlock`, `lastRebuiltAt`, `lastReconciledAt`, `safeToServeIndexedState`, and `staleReason` when present;
- fleet/highscore `generatedAt`, fleet `indexedBlock`, and `indexedRevision`;
- per-planet `resourceSnapshot.blockNumber`, `logIndex`, `transactionHash`, and `lastSettledAt`; and
- independently observed Base finalized block number, hash, and timestamp.

An API indexed block may be newer than the current finalized RPC cursor. That is expected near head and must be represented, not coerced. Missing metadata is recorded as unavailable. A stale or partial batch must never replace the last complete good snapshot without carrying explicit failure state.

## Units And Representation

- Resource balances, rates, costs, cargo, scores, and other contract-sized integers arrive as canonical decimal strings and must remain lossless. They represent Veydrift's internal game units unless a field explicitly identifies an external token quantity.
- Building and technology levels, item IDs, counts where the response type uses a JSON number, coordinates, and pagination fields remain integers after safe-range validation.
- ISO timestamps such as `generatedAt` remain distinct from Unix-second decimal strings such as `lastSettledAt`, `arrivalAt`, `readyAt`, and `returnAt`.
- Block numbers may arrive as decimal strings in REST and hex strings in JSON-RPC. Normalize the value while retaining the source encoding and source identity.
- Game-controlled strings are data only and are never forwarded as instructions.

## Collection Guidance For Later Units

Unit 4 should inject its HTTP and RPC transports, validate runtime identity before player collection, request one overview, fan out the four verified detail reads for every managed planet, then collect highscores, active missions, and only the relevant universe systems. Unit 5 will decide the final interval and retry policy.

Current upstream code limits rate-controlled read paths to 40 requests per normalized route in a 10-second window and returns `429` with `retry-after`. This is an upper safety boundary, not a target rate. The worker must avoid overlap, honor `retry-after`, and use the smallest request set needed for a snapshot.

## Synthetic Fixtures

The fixtures under `apps/operator/test/fixtures/snapshot-source/` mirror the accepted field shapes without copying live player identities, names, resources, scores, missions, or transaction records:

- `representative.json` contains a complete synthetic source batch; and
- `partial.json` contains stale metadata, omitted optional data, and an endpoint failure envelope for incomplete-state testing.

They are discovery artifacts for Unit 3 schemas and normalizers, not proof that a future live response remains compatible. Unknown fields must be handled deliberately, required-field loss must fail visibly, and every source-contract change must record a new upstream commit.
