# Veydrift Operator v1 Implementation Plan

## Purpose

Build an open-source, self-hosted operator that helps a Veydrift player pursue the highest contract-ranked Veydrift Score (`totalUserScore`) with an economy-first strategy.

The operator should observe the public game state, preserve useful history, recommend strategic changes, and execute routine actions after the player approves a bounded strategy. It should notify the player when attention is needed and explain what it did and what happened.

## Alignment Summary

- Optimize for canonical `totalUserScore`, initially through compounding economic growth.
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
- live backend build commit `456b976189e88d404863822b12697faa7d2d028a` from 2026-07-31.

At refresh time, public stats showed 62 players and 159 planets; the leader had 64,306 `totalUserScore`. These values are dynamic, not configuration constants.

Important game constraints:

- Contracts and indexed chain data are canonical; gameplay state is intentionally public.
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
- Rules can change through upgradeable contracts. The operator must identify the active deployment and detect incompatible upstream changes.

The implementation must use live runtime configuration, deployed contract code, and ABI behavior when prose documentation or upstream `main` disagrees with the deployed game.

## v1 Product Scope

### Required

- Local onboarding for one wallet and one Veydrift deployment.
- Current-state dashboard for planets, resources, production, queues, research, fleets, defenses, missions, and score.
- Historical snapshots sufficient to graph growth and evaluate past decisions.
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
- minimum resource reserves,
- maximum resource spend,
- maximum gas spend,
- prerequisite and queue rules,
- defensive-response rules,
- start, expiry, and revocation state,
- an immutable strategy version identifier.

Attacks, Rift extraction, planet abandonment, market withdrawals, alliance mutations, token/CCA participation, secret changes, and other high-impact actions remain manual unless a later plan explicitly defines and verifies a safe envelope for them.

## Initial Strategy Direction

The first strategy should favor compounding canonical-score growth:

1. Optimize for canonical `totalUserScore`; report economy, research, and military resource-value scores separately.
2. Avoid idle construction and research queues when an approved useful action is affordable.
3. Prevent resource production from sitting at storage caps.
4. Use ship and defense FIFO backlogs only within approved reserve and exposure limits.
5. Rank actions by prerequisites, canonical score delta, resource-score delta, production gain, completion time, and opportunity cost.
6. Preserve enough energy, deuterium, cargo capacity, fleet slots, gas, and defensive flexibility to keep the economy operating.
7. Expand into additional planets when colonization produces a better long-term growth path than another home-planet upgrade.
8. Convert excess resources into productive score while avoiding easily raidable concentrations.
9. Keep Rift extraction disabled initially; require a dedicated policy that models the 28-day raid exposure.
10. Re-evaluate priorities after partial or full queue settlement, material state changes, attacks, losses, deployment changes, or sustained divergence from expected growth.

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
- Track upstream commit, deployed contract commit, backend build, chain ID, contract addresses, ABI hash, indexed block, and snapshot time.
- Poll for reconciliation even when an event stream is connected.

### Strategy And Decision Model

- Strategies are versioned data plus deterministic evaluation code.
- Every recommendation records the observed state, candidate actions, score, rationale, and selected action.
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

- [ ] Create the Bun workspace, configuration validation, tests, and local run commands.
- [ ] Pin the live chain, contracts, ABI hash, deployment commit, backend build, and API surfaces in a deployment manifest.
- [ ] Fail closed at startup when the live deployment is incompatible with a supported manifest.
- [ ] Add safe wallet-address derivation without exposing the private key.
- [ ] Add fixture-based game-state tests.
- [ ] Pass the Phase 0 exit gate, then explicitly approve wallet funding and first-planet settlement before Phase 1 begins.

### Phase 1: Read-Only Operator

- [ ] Collect wallet, planet, resource, queue/backlog, research, fleet, mission, Rift-lock, universe, deployment-identity, and highscore state.
- [ ] Persist normalized snapshots and sync health in SQLite.
- [ ] Build the first dashboard overview and historical growth view.
- [ ] Detect inbound hostile missions, idle queues, and resource-cap risk.

### Phase 2: Alerts And Economy Recommendations

- [ ] Define the notifier interface and ship the Telegram adapter.
- [ ] Implement the first explainable economy-first action ranking.
- [ ] Show prerequisites, cost, canonical score delta, resource-score delta, growth effect, and timing.
- [ ] Record recommendation outcomes and forecast error.

### Phase 3: Approve-Only Execution

- [ ] Implement the action state machine, exact transaction construction, simulation, and receipt tracking.
- [ ] Revalidate chain ID, contract address, ABI hash, state, and simulation immediately before signing.
- [ ] Require dashboard approval for every transaction.
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
- revalidation and simulation immediately before submission,
- receipt and outcome reconciliation after submission,
- clean pause and recovery after failures.

Use fixtures, local simulation, and a fork of the exact Base mainnet deployment for execution tests. Permit only explicitly approved, low-value live transactions after those checks pass. Autonomous mode should not be enabled until the same action types have completed successfully through approve-only mode.

## Open Decisions Before Implementation

- After Phase 0 passes, fund the generated wallet and settle its first planet before live observation begins.
- Establish an initial ETH funding and maximum gas budget.
- Create the Telegram bot and configure its token and destination chat locally.
- Agree on the first economy strategy thresholds after the wallet owns a planet and real state is observable.
- Choose an open-source license before the first public release.

## First Build Agreement

Before enabling automation:

> Build the read-only truth layer first, make economy recommendations explainable, prove each transaction path in approve-only mode, and only then allow an explicitly approved strategy version to perform bounded routine actions. Keep every decision and outcome auditable, every integration replaceable, and every unsafe or surprising condition able to pause the operator.
