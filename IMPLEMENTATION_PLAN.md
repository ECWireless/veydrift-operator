# Veydrift Operator v1 Implementation Plan

## Purpose

Build an open-source, self-hosted operator that helps a Veydrift player first achieve and maintain the highest contract-ranked Veydrift Score (`totalUserScore`) with an economy-first strategy, then maximize net financial return under an approved risk budget without jeopardizing that primary objective.

The operator should observe the public game state, preserve useful history, recommend strategic changes, and execute routine actions after the player approves a bounded strategy. It should notify the player when attention is needed and explain what it did and what happened.

## Alignment Summary

- Optimize for canonical `totalUserScore`, initially through compounding economic growth.
- After achieving and while maintaining the top canonical rank, optimize net financial return under an approved, versioned financial-objective specification and risk budget.
- Begin in observe-only and approve-only modes.
- End v1 with bounded autonomous execution under an approved, versioned strategy.
- Use the generated wallet as the player and transaction-signing wallet.
- Run locally first and keep a straightforward path to a private hosted instance.
- Support one player wallet per deployment for v1.
- Ship Telegram notifications first behind a provider-neutral notifier interface.
- Keep approvals in the dashboard; Telegram notifications may link to them.
- Record inputs, decisions, transactions, and outcomes so strategy can improve over time.
- Do not fund the operator wallet or claim its first planet until Phase 0 is complete and its exit gate passes.

## Research Baseline

This plan was refreshed on 2026-08-03 against:

- upstream source commit `83d7b81511f996f22229c29710712d04cd1f0d87` from 2026-08-01,
- the live Base mainnet deployment (`chainId` 8453), game contract `0xf397910F005151b09644228573a4353818D3755d`, deployment commit `701bed3578cff4d134657c714c599dbdb55a4b6a`, and ABI hash `sha256:62cdedb794d4aa11cce1e9ef61e26f12227ce40a3bf47dd6156db6dc5676bc99`, and
- live backend build commit `30d904defb684f528cbefc55ac14f87b0cce3331` observed on 2026-08-04, and
- the maintainer-supplied Veydrift whitepaper Version 1.1 from July 2026 (`sha256:8df4752e969a78aea041483daba10ee1a0a86873021d28d991a3ba3364e6ffaf`), summarized in [`docs/research/veydrift-whitepaper.md`](docs/research/veydrift-whitepaper.md).

The whitepaper is economic and design context. It does not override the live deployment, and its token-launch parameters, dollar values, production valuations, and liquidity scenarios are illustrative until independently verified.

At refresh time, public stats showed 62 players and 159 planets; the leader had 64,306 `totalUserScore`. These values are dynamic, not configuration constants.

Important game constraints:

- Verified live contracts are canonical; runtime configuration and indexed chain data must reconcile against them. Gameplay state is intentionally public.
- The primary leaderboard uses contract `totalUserScore`: technology level × `(technology id + 1)` × 15, plus 1,000 per owned planet, building level × `(building id + 1)` × 10, defense count × `(defense id + 1)` × 2, and ship count × `(ship id + 1)` × 4. Moon buildings are excluded.
- Economy, research, and military resource-value scores remain useful secondary metrics, but their sum is not the primary leaderboard score.
- Unspent resources do not add score, while completed buildings, research, ships, and defenses do.
- Construction, research, ship, defense, and fleet activity are queue- and time-based.
- Ship and defense production use FIFO backlogs with progressive per-unit settlement inside each batch.
- Fleet capacity, fuel, travel time, recall, attack limits, score protection, loot, debris, and combat are contract-enforced.
- Rift extraction creates planet-scoped locked resources, exposes them to raids for a 28-day delay, and bypasses ordinary score/newbie and bashing protection for attacks against active locks.
- Hostile inbound missions have a canonical 30-minute reveal window, although public chain data may make earlier detection possible.
- The existing game backend indexes chain events into SQLite and exposes wallet, planet, queue, mission, universe, highscore, tactical, and chain-event read surfaces.
- A versioned deterministic combat-preview catalog exists upstream and should be reused for battle preflight.
- Public aggregate telemetry is served from `stats.veydrift.com`; the old backend `/stats` route is retired.
- Token and Uniswap CCA work exists upstream but is not authorized for production deployment and is not currently part of the live strategy surface.
- The whitepaper defines a strict distinction between 6-decimal external resource-token quantities and internal game-resource units, with one whole token intended to represent 1,000,000 internal units; the operator must verify and preserve that boundary wherever it applies.
- Production and external resource value are not guaranteed yield. Only verified prices, executable liquidity, attributable outcomes, and an approved risk model may inform the secondary financial objective; whitepaper valuation scenarios are never production constants.
- Rules can change through upgradeable contracts. The operator must identify the active deployment and detect incompatible upstream changes.

The implementation must use live runtime configuration, deployed contract code, and ABI behavior when prose documentation or upstream `main` disagrees with the deployed game.

## v1 Product Scope

### Required

- Local onboarding for one wallet and one Veydrift deployment.
- Current-state dashboard for planets, resources, production, queues, research, fleets, defenses, missions, and score.
- Historical snapshots sufficient to graph growth and evaluate past decisions.
- Separate score and financial-performance views that preserve the ordered objectives and expose every valuation, cost, liquidity, and risk assumption.
- Queue-idle, resource-cap, incoming-raid, action-result, and strategy-review alerts.
- Telegram notification adapter.
- Economy-first recommendations with costs, prerequisites, expected benefit, and rationale.
- Versioned strategy documents that the player can inspect and approve.
- Action proposals with simulation, policy evaluation, execution state, and audit history.
- Approve-only execution before autonomous execution is enabled.
- Autonomous routine actions that remain inside the approved strategy envelope.
- A global pause/kill switch and an easy downgrade to approve-only or observe-only.
- Outcome attribution: connect each confirmed action to the strategy decision that caused it.
- Periodic strategy review that recommends a new strategy version rather than silently changing policy.
- Configuration and documentation suitable for another player to self-host.

### Explicitly Deferred

- Multi-user SaaS, shared custody, accounts, billing, and tenant isolation.
- Coordinating multiple player wallets.
- A runtime marketplace for third-party plugins.
- Telegram-based transaction approval.
- Autonomous strategy changes without player approval.
- Autonomous destructive or ownership-changing actions.
- Guaranteed profitability or a fixed claim that one strategy will remain optimal as the game changes.

## Operating Modes

### Observe Only

Read, store, analyze, and notify. Never create or submit transactions.

### Approve Only

Create fully specified action proposals. The player reviews and approves each proposal in the dashboard before signing and submission.

### Strategy Autonomy

The player approves a specific strategy version and safety envelope. The operator may automatically execute only actions allowed by both.

An approved envelope should include:

- allowed action types,
- eligible planets,
- active objective, canonical rank or score-lead conditions, and primary-preservation horizon and stress assumptions,
- minimum resource reserves,
- maximum resource spend,
- maximum gas spend,
- maximum financial and Rift exposure where applicable,
- prerequisite and queue rules,
- defensive-response rules,
- start, expiry, and revocation state,
- an immutable strategy version identifier.

Attacks, Rift extraction, planet abandonment, market withdrawals, alliance mutations, token/CCA participation, secret changes, and other high-impact actions remain manual unless a later plan explicitly defines and verifies a safe envelope for them.

## Initial Strategy Direction

The objectives are ordered rather than blended: financial optimization activates only after the wallet reaches the top canonical rank, and it must not violate the approved conditions for maintaining that rank.

1. Reach and maintain the highest canonical `totalUserScore`; report economy, research, and military resource-value scores separately.
2. Only while the top-rank conditions and primary-preservation test hold, maximize the deterministic net-return metric defined by the approved financial-objective specification. Report realized net return separately from forecasts adjusted for gas, fees, slippage, price impact, raid and combat loss, committed capital, opportunity cost, and risk.
3. Keep forecasts and market valuations distinct from realized outcomes, expose every assumption, and never frame projected production as guaranteed yield or profit.
4. Avoid idle construction and research queues when an approved useful action is affordable.
5. Prevent resource production from sitting at storage caps.
6. Use ship and defense FIFO backlogs only within approved reserve and exposure limits.
7. Rank actions by prerequisites, canonical score delta, resource-score delta, production gain, completion time, financial effect when verified, and opportunity cost.
8. Preserve enough energy, deuterium, cargo capacity, fleet slots, gas, score lead, and defensive flexibility to keep the economy operating.
9. Expand into additional planets when colonization produces a better long-term growth path than another home-planet upgrade.
10. Convert excess resources into productive score while avoiding easily raidable concentrations until the secondary objective is active and a financial candidate independently passes the primary-preservation, financial-policy, and freshness gates.
11. Keep Rift extraction disabled initially; require a dedicated policy that models the 28-day raid exposure before it can contribute to the secondary objective.
12. Re-evaluate priorities after rank changes, partial or full queue settlement, material state changes, attacks, losses, deployment changes, market or liquidity changes, or sustained divergence from expected growth or financial outcomes.

The strategy engine should explain rankings and assumptions. It should not begin as an opaque optimizer.

## Architecture

```text
Veydrift API / SSE / Base RPC
              |
        State collector
              |
       SQLite event store
              |
       Normalized game state
              |
         Strategy engine
              |
        Action proposals
          /         \
 Dashboard       Notifier interface
     |             Telegram adapter
 Approval policy
     |
 Simulation -> Signer -> Base transaction
     |
 Receipt and outcome recorder
```

### Repository Shape

Use a Bun and TypeScript workspace:

```text
apps/
  operator/       collector, scheduler, strategy runner, executor, API
  dashboard/      local control center and approvals
packages/
  core/           domain types, formulas, strategies, policies
  veydrift/       API, ABI, RPC, and deployment adapters
  storage/        SQLite schema and repositories
  notifiers/      notifier contract and provider adapters
```

Keep these package boundaries lightweight. They exist to prevent game reads, strategy, notifications, and signing from becoming inseparable—not to create independent services prematurely.

### Data Acquisition

- Prefer indexed Veydrift API reads and chain-event streaming for normal operation.
- Use direct RPC reads for deployment discovery, verification, simulation, and fallback where necessary.
- Fetch and validate live runtime configuration at startup and immediately before transaction construction.
- Persist raw source metadata with normalized snapshots so decisions can be reproduced.
- Preserve source denomination and conversion metadata so internal resource units are never confused with external token quantities.
- Track reserve coverage and locked-exit exposure when verified live interfaces make them available.
- Track upstream commit, deployed contract commit, backend build, chain ID, contract addresses, ABI hash, indexed block, and snapshot time.
- Poll for reconciliation even when an event stream is connected.

### Strategy And Decision Model

- Strategies are versioned data plus deterministic evaluation code.
- Define a versioned financial-objective specification before secondary optimization. It fixes the accounting asset, evaluation horizon, cash-flow and cost-basis rules, realized and marked-value treatment, net-return function, risk budget and penalty, primary-preservation test, and required data freshness.
- Evaluate and report the score and financial objectives separately. Reject every financial candidate that cannot prove primary-objective preservation over the approved horizon and stress assumptions. The secondary objective remains inactive until fresh canonical state proves the approved top-rank conditions and suspends when those conditions become stale or false.
- Every recommendation records the observed state, candidate actions, score, rationale, and selected action.
- Financial evaluations record their specification version, accounting asset, horizon, cash flows, cost basis, prices or executable quotes, liquidity, costs, risk assumptions, forecast value, and attributable realized outcome without mixing forecast and realized measures.
- Strategy changes create a new draft version for player review.
- Approval applies to an exact version and envelope; edits invalidate prior approval.
- The first optimizer should be deterministic and inspectable. Simulation or learning can augment it later.

### Action Lifecycle

```text
proposed -> policy_checked -> awaiting_approval | authorized
authorized -> simulated -> submitted -> confirmed | failed
confirmed -> outcome_pending -> evaluated
```

Immediately before submission, re-read relevant state, re-run policy checks, and simulate the exact transaction. A stale or failing proposal must not be submitted.

### Notification Extension

Define a small notifier contract around typed events such as:

- incoming raid,
- queue idle,
- action awaiting approval,
- action confirmed or failed,
- automation paused,
- strategy review ready.

Telegram is the first adapter. Other platforms should require a new adapter and configuration, not changes to strategy or execution code.

### Secret Handling

- Local secrets live in `.env`, which is ignored and permission-restricted.
- Never return secrets through the operator API or dashboard.
- Redact sensitive values from logs and errors.
- The hosted migration must move secrets into the host's secret store.
- Long-term custody improvements, including hardware or delegated signing, require Veydrift support or a separately accepted design.

## Delivery Phases

### Phase 0: Scaffold And Deployment Discovery

- [x] Create the Bun workspace, configuration validation, tests, and local run commands.
- [ ] Pin the required core chain, game contract, ABI hash, deployment commit, backend build, and API surfaces, plus separately verified optional capability contracts, in a deployment manifest.
- [ ] Fail closed at startup when the core live deployment is incompatible with a supported manifest; disable an incompatible optional capability without blocking safe score-only operation.
- [x] Add safe wallet-address derivation without exposing the private key.
- [ ] Add fixture-based game-state tests.
- [ ] Pass the Phase 0 exit gate, then explicitly approve wallet funding and first-planet settlement before Phase 1 begins.

#### Phase 0 Unit Ledger

This ledger shows the working PR-sized decomposition for the current phase. Planned entries are directional rather than implementation approval: refine each entry during its debrief, obtain explicit approval, keep its status current, and record the merged result and verification evidence before beginning the next unit.

1. **Workspace foundation — merged 2026-08-03** (`#1`, `1d08e32`)
   - Established the Bun 1.3.14 and TypeScript workspace, operator entry point, local run commands, and formatting, lint, type-check, test, and build baseline.
   - Verified the frozen dependency install, complete local check, independent review, and manual startup flow.
2. **Local operator identity — merged 2026-08-03** (`#2`, `6a43b82`)
   - Added the synthetic environment template, fail-closed private-key validation, and server-side derivation of an immutable, checksummed public wallet address with sanitized configuration failures.
   - Kept signing, RPC, transaction execution, and dashboard authentication outside the unit; documented that a remotely accessible dashboard needs its own human-authentication boundary.
   - Verified the frozen dependency install, complete local check, boundary and secp256k1 edge-case tests, two independent reviews, and manual startup with the ignored local configuration.
3. **Supported deployment manifest — implemented 2026-08-04; awaiting review and merge**
   - Added a versioned, strict, deeply immutable manifest that pins the required Base chain, game proxy and implementation bytecode identities, ABI hash, deployment commit, backend build, authoritative runtime/API surfaces, fixed-block verification evidence, and research provenance.
   - Independently represented optional capabilities: resource-token proxy and implementation identities, code, symbols, and decimals are supported observations, while Rift and market operation remain explicitly disabled. Deterministic tests cover validation, normalization, immutability, cross-field invariants, and score-only operation with optional capabilities disabled; live compatibility enforcement, signing, and transactions remain excluded.
4. **Runtime deployment compatibility gate — planned**
   - Resolve the core live deployment identity through bounded read-only adapters, compare it with the supported manifest, and refuse normal startup on an incompatible or unverifiable core target. Probe optional capabilities independently and keep each disabled unless it verifies.
   - Cover supported, mismatched, malformed, unavailable-core, and unavailable-optional paths with deterministic fixtures and sanitized failures; exclude all wallet signing and transaction construction.
5. **Game-state fixture test harness — planned**
   - Add reusable fixture conventions and a minimal canonical player-state case covering a wallet, one planet, its resources and denominations, and score so Phase 0 can prove deterministic offline game-state tests.
   - Verify fixture loading and representative valid and malformed inputs; defer the full normalized domain model, queues, research, fleets, missions, defenses, Rift locks, universe state, live collection, and persistence to Phase 1.
6. **Phase 0 exit gate — planned**
   - Run and record the complete Phase 0 verification baseline, review deployment and secret boundaries, exercise approved read-only startup paths, and publish a clear go/no-go checklist with remaining assumptions.
   - Keep wallet funding and first-planet settlement outside this unit; each remains blocked until the gate passes and receives separate explicit approval.

### Phase 1: Read-Only Operator

- [ ] Collect wallet, planet, resource, queue/backlog, research, fleet, mission, Rift-lock, reserve-coverage, universe, deployment-identity, and highscore state where verified live interfaces support them.
- [ ] Persist normalized snapshots and sync health in SQLite.
- [ ] Build the first dashboard overview and historical growth view.
- [ ] Detect inbound hostile missions, idle queues, and resource-cap risk.

### Phase 2: Alerts, Economy, And Financial Recommendations

- [ ] Define the notifier interface and ship the Telegram adapter.
- [ ] Implement the first explainable economy-first action ranking.
- [ ] Show prerequisites, cost, canonical score delta, resource-score delta, growth effect, and timing.
- [ ] Define and version the deterministic financial-objective specification and primary-preservation gate before enabling secondary optimization.
- [ ] Add capability-scoped read-only financial accounting and verified quote inputs that keep cost basis, cash flows, marked forecasts, attributable realized outcomes, liquidity, and all costs distinct.
- [ ] Show financial recommendations only when fresh rank, primary-preservation, accounting, price, liquidity, reserve where relevant, conversion, and risk-model inputs all pass; otherwise continue safe score-only behavior.
- [ ] Record score and financial recommendation outcomes and forecast error separately.

### Phase 3: Approve-Only Execution

- [ ] Implement the action state machine, exact transaction construction, simulation, and receipt tracking.
- [ ] Revalidate chain ID, contract address, ABI hash, state, and simulation immediately before signing.
- [ ] Require dashboard approval for every transaction.
- [ ] Keep every separately admitted financial action disabled by default and subject to per-action dashboard approval; otherwise keep the secondary objective advisory only.
- [ ] Add resource, gas, queue, planet, and method-level policy checks.
- [ ] Add pause controls, failure handling, idempotency, and a complete audit trail.

### Phase 4: Approved Strategy Autonomy

- [ ] Add strategy drafting, version comparison, approval, expiry, and revocation.
- [ ] Automatically execute approved construction, research, and production actions within limits.
- [ ] Keep Rift extraction, PvP attacks, and token/CCA participation manual unless separately designed and approved.
- [ ] Reconcile every outcome and pause on unexpected state, repeated failure, or policy breach.
- [ ] Recommend new strategy versions when results or game conditions justify a change.

### Phase 5: Defensive Playbooks And Hosting Readiness

- [ ] Add bounded raid-response playbooks using only actions validated for the player's current capabilities.
- [ ] Alert when no authorized defensive action is safe or possible.
- [ ] Containerize the single-player deployment and document backup, restore, upgrade, and secret migration.
- [ ] Verify restart recovery, provider outages, missed events, reorg handling, and emergency pause behavior.

## Verification Plan

Each phase should verify:

- behavior against pinned upstream fixtures and current formulas,
- restart-safe and duplicate-safe collection,
- deterministic recommendations from the same state,
- notifier failure isolation,
- secret redaction,
- no transaction submission in observe-only mode,
- no unapproved transaction submission in approve-only mode,
- no autonomous action outside the exact approved strategy envelope,
- no activation of the secondary financial objective before its deterministic specification is approved and fresh canonical state satisfies its rank, score-lead, and primary-preservation conditions,
- rejection of any financial candidate that cannot prove primary-objective preservation over the approved horizon and stress assumptions,
- suspension of the secondary objective when rank, quote block or time, executable liquidity, reserve coverage where relevant, unit conversion, accounting completeness, or risk-model evidence is stale, missing, or inconsistent; safe score-only behavior must remain available when only an optional capability fails,
- no financial recommendation based on gross value that omits the specification's costs and risk, or that mixes forecast, marked, and realized measures,
- revalidation and simulation immediately before submission,
- receipt and outcome reconciliation after submission,
- clean pause and recovery after failures.

Use fixtures, local simulation, and a fork of the exact Base mainnet deployment for execution tests. Permit only explicitly approved, low-value live transactions after those checks pass. Autonomous mode should not be enabled until the same action types have completed successfully through approve-only mode.

## Open Decisions Before Implementation

- After Phase 0 passes, fund the generated wallet and settle its first planet before live observation begins.
- Establish an initial ETH funding and maximum gas budget.
- Create the Telegram bot and configure its token and destination chat locally.
- Agree on the first economy strategy thresholds after the wallet owns a planet and real state is observable.
- As a hard prerequisite to secondary optimization, approve the versioned financial-objective specification and activation envelope: accounting asset, evaluation horizon, cash-flow and cost-basis rules, realized versus marked value, return versus absolute net proceeds, minimum score lead, primary-preservation test, risk budget and penalty, resource reserves, Rift exposure, gas, slippage, price impact, required data freshness, and minimum executable liquidity.
- Choose an open-source license before the first public release.

## First Build Agreement

Before enabling automation:

> Build the read-only truth layer first, make economy recommendations explainable, prove each transaction path in approve-only mode, and only then allow an explicitly approved strategy version to perform bounded routine actions. Keep every decision and outcome auditable, every integration replaceable, and every unsafe or surprising condition able to pause the operator.
