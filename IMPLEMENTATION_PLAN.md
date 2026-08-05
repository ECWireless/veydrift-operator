# Veydrift Operator MVP Implementation Plan

## Purpose

Build a small, self-hosted Veydrift companion that:

1. refreshes a trustworthy snapshot of the public game universe and one configured player on an interval;
2. presents a useful narrative of that universe and the player's place in it; and
3. answers nonpersistent strategy questions using the latest snapshot, verified game rules, and clearly labeled design context.

The MVP is read-only and advisory. It never signs, submits, approves, or automates a game action.

## Product Experience

The local dashboard should answer three questions without requiring the player to inspect raw chain or API data:

- What is happening in the Veydrift universe now?
- Where am I in that universe, and what materially constrains or enables me?
- Given the current evidence and my objectives, how should I think about a strategy decision?

The default advisory objective profile remains ordered: first pursue and maintain the highest canonical `totalUserScore`, then consider financial yield when verified market and accounting inputs make that question answerable. This is context for explanations, not an automated optimizer or promise of return.

## Authority And Grounding

Generated analysis must not depend on model memory alone. Every request receives a curated context package assembled from:

1. verified deployed game rules and formulas;
2. reconciled runtime and indexed state metadata;
3. the maintained whitepaper research note, labeled as design and economic context;
4. the configured advisory objective profile;
5. the latest normalized snapshot and deterministic derived facts;
6. snapshot freshness, missing inputs, and source provenance; and
7. the current browser-session chat turns.

Game-controlled strings are untrusted data, never instructions. Responses must distinguish observed facts, deterministic calculations, inferences, assumptions, and unavailable information. Whitepaper claims never override verified live behavior.

## MVP Scope

### Required

- One locally configured public player wallet address.
- Immediate snapshot refresh at startup and repeated refresh on a configurable interval.
- A normalized, immutable latest snapshot with source and freshness metadata.
- A model-ready digest containing the player's full relevant state, a compact universe view, and deterministic observations.
- A dashboard overview of the universe, player position, snapshot freshness, and collection errors.
- One cached narrative per snapshot so page loads do not create repeated model charges.
- A nonpersistent chat interface for strategy questions.
- Server-side OpenAI Responses API integration with storage disabled and a configurable model.
- Fixture-based normalization tests and a bounded real-data analysis QA gate before the narrative UI is accepted.

### Explicitly Deferred

- Private-key custody, transaction construction, signing, simulation, submission, approvals, and autonomous actions.
- Wallet funding and first-planet settlement workflows.
- Telegram, alerts, schedulers beyond snapshot refresh, and defensive playbooks.
- Persistent chat, saved conversations, user accounts, and public-host authentication.
- Multi-player or multi-tenant operation.
- Historical storage until Phase 2 measures its value and cost.
- Deterministic action ranking, financial optimization engines, risk budgets, and outcome attribution.
- Market, Rift, resource-token, liquidity, or attack automation.
- Vector databases, embeddings, RAG infrastructure, model tool calling, and agent frameworks unless analysis QA demonstrates a concrete need.

## Architecture

```text
Veydrift public API / Base RPC
              |
      Interval snapshot worker
              |
      Latest normalized snapshot
          /                 \
 Deterministic digest     Dashboard API
          |                 |
  OpenAI analysis API ---- Dashboard
          |
  Narrative and strategy answers
```

One Bun process should own the worker, current snapshot, analysis boundary, and dashboard API. React with Vite remains the dashboard baseline. The first snapshot store is memory; persistence is a measured decision rather than a default dependency.

## OpenAI Boundary

- Keep `OPENAI_API_KEY` only in the server environment.
- Use the OpenAI Responses API with `store: false`.
- Default to the current approved latest model through configuration rather than scattering a model identifier through the codebase. At Phase 1 planning time, OpenAI's current alias is [`gpt-5.6`](https://developers.openai.com/api/docs/guides/latest-model); verify it again when Phase 3 implements the integration.
- Start with low reasoning effort for routine snapshot narratives and medium effort for strategy questions; change this only when evaluations justify it.
- Send a curated context package and compact snapshot digest, not secrets or an undifferentiated repository dump.
- Keep application chat turns in browser memory with no server conversation store. Each request still transmits the turns needed for the current answer to OpenAI. `store: false` disables retrievable Responses application state but does not promise Zero Data Retention; disclose the separate [OpenAI API data-retention boundary](https://developers.openai.com/api/docs/guides/your-data#data-retention-controls-for-abuse-monitoring).
- Use ordinary request/response behavior first. Streaming, model tools, persistent reasoning, and conversation objects are deferred.

## Delivery Phases

### Phase 1: Scope Reset — implemented and reviewed 2026-08-05; awaiting merge

Deliver this documentation-only reset as one pull request:

- Replace the automation-oriented contributor mission and implementation roadmap with the read-only snapshot, narrative, and chat MVP.
- Preserve verified deployment and whitepaper research as context while removing obsolete execution commitments.
- Record the grounding package, nonpersistent OpenAI boundary, history decision gate, and analysis QA phase.
- Reconcile the README and maintained research documents with the new scope.

Phase 1 changes no production code, dependency, runtime configuration, data, secret, external service, or deployment. The prior unpushed runtime-compatibility branch remains parked and is not part of this phase.

Exit gate:

- tracked documentation agrees on the new product boundary;
- obsolete signing, approval, autonomy, Telegram, and financial-optimizer commitments are explicitly retired;
- the complete repository check passes; and
- one fresh-context reviewer finds no unresolved scope or authority conflict.

### Phase 2: Snapshot Worker And History Decision — planned

Build the read-only truth layer:

- Replace the legacy private-key startup requirement with one validated public player address.
- Discover and lightly validate Base chain ID, game address, public response schemas, and freshness without pinning a volatile backend build.
- Refresh immediately at startup and on a configurable interval.
- Normalize the player, planets, resources, production, queues, research, fleets, defenses, missions, score, highscores, and relevant universe state exposed by verified public interfaces.
- Retain source identity, observation time, indexed block or equivalent cursor, units, and missing-field state.
- Produce both the raw normalized snapshot and a compact model-ready digest.
- Expose current snapshot, collection status, last success, and last error through a small read API.

#### Historical Snapshot Decision Gate

Do not choose SQLite or another persistent store before collecting evidence. Once a representative real snapshot exists:

1. Capture a bounded disposable sequence in memory or an ignored temporary file outside the repository. Use a 24-hour default observation window; extend once, up to 72 hours total, only when no meaningful game-state change occurred.
2. Measure serialized and compressed byte sizes for the real samples.
3. Project storage at candidate intervals such as 1, 5, and 15 minutes over 30 days and one year.
4. Ask a preselected history-only question set about score velocity, rank trajectory, production growth, queue utilization, resource-cap behavior, and comparisons with leading players.
5. Count history as useful only when the sample supports at least two material, factually grounded answers that the latest snapshot alone cannot provide.
6. Compare latest-only, a short rolling window, downsampled long-term history, and full interval history.
7. Choose the smallest retention policy that produces the demonstrated value, or explicitly retain no history.

Record the decision, sample window, observed changes, question results, and size projections in the plan, then discard the temporary sample unless the approved retention design deliberately imports it. If the selected persistence work is not comfortably contained in the Phase 2 pull request, debrief it as a bounded follow-up before beginning Phase 3.

Exit gate:

- deterministic fixtures and one approved bounded live smoke produce an inspectable current snapshot;
- repeated refresh, stale state, partial failure, and recovery behave predictably;
- the model-ready digest preserves the exact facts required for analysis; and
- the history decision is documented with measured size and usefulness evidence.

### Phase 3: Analysis Grounding And QA — planned

Prove the analysis before building the product around it:

- Create the smallest maintained game-context package covering verified formulas, prerequisites, queues, movement, combat, scoring, units, and relevant whitepaper context.
- Add the server-side OpenAI boundary for narrative and strategy responses without adding the final chat UI.
- Define representative questions covering universe narrative, player position, rank gaps, growth constraints, next-step tradeoffs, resource bottlenecks, threats, uncertainty, and deliberate hallucination traps.
- Have Codex independently inspect the real snapshot and source context to produce reference narratives and strategy answers.
- Run the same questions through the application backend using an explicitly approved API key, call cap, and cost boundary.
- Compare factual accuracy, rule grounding, reasoning, evidence, freshness handling, uncertainty, and usefulness.
- Adjust the snapshot digest, deterministic derived facts, context selection, and prompts through bounded evaluation rounds.
- Preserve the questions and semantic acceptance criteria as regression evaluations; do not freeze exact model prose.

Exit gate:

- responses contain no contradictions with the evaluation snapshots;
- no answer invents mechanics or silently treats whitepaper context as deployed fact;
- stale and missing inputs are disclosed;
- recommendations cite the material snapshot facts and constraints behind them; and
- no extra retrieval, tool, or agent infrastructure is added without an observed evaluation failure that it directly resolves.

### Phase 4: Dashboard Narrative — planned

- Build the React dashboard around current snapshot loading, freshness, collection errors, universe summary, and player position.
- Generate a narrative lazily and cache it by snapshot identity so repeated page loads do not repeat model charges.
- Show the narrative's observation time, important evidence, and material caveats.
- Verify the primary local dashboard workflow at agreed desktop and mobile widths.

Exit gate:

- the player can understand the latest universe and personal position from one screen;
- loading, empty, stale, partial, failed, and refreshed states are clear; and
- narrative rendering cannot hide contradictory deterministic facts.

### Phase 5: Nonpersistent Strategy Chat — planned

- Add a chat panel backed by the Phase 3 analysis boundary.
- Keep application turns in browser memory and clear them on reload while disclosing that submitted content is transmitted to OpenAI under its API data-retention policy.
- Include the current snapshot identity with each request and visibly disclose when the snapshot changes during a chat.
- Prevent overlapping requests, bound input and output sizes, sanitize failures, and keep the API key server-side.
- Verify representative strategy questions in the browser against the maintained analysis evaluations.

Exit gate:

- the player can ask follow-up strategy questions grounded in the current snapshot;
- reload clears the conversation;
- OpenAI storage remains disabled;
- model or provider failure cannot affect snapshot collection or deterministic dashboard facts; and
- the application exposes no game-mutation or wallet-signing path.

## Completed Foundation Context

Earlier merged work remains useful context but does not define the new MVP:

- Workspace foundation (`#1`, `1d08e32`) established Bun, TypeScript, commands, and verification.
- Local operator identity (`#2`, `6a43b82`) proved sanitized wallet derivation but is now legacy because the read-only MVP needs only a public address.
- Supported deployment manifest (`#3`, `bab419b`) preserves reviewed deployment and research provenance but is not a requirement to block the read-only observer on every backend rebuild.
- The unpushed runtime compatibility commit `fab7e8d` remains parked on `feat/phase-0-runtime-compatibility` and is not included in this roadmap.

## Verification And Publication

For each phase:

- keep normal tests deterministic and offline;
- scope live Veydrift and OpenAI calls separately with explicit call, mutation, and cost boundaries;
- review the complete diff for factual accuracy, source authority, secret handling, unnecessary complexity, and phase compliance;
- run the fresh-context review required by `docs/session-workflow.md`; and
- obtain separate approval before staging, committing, pushing, creating or mutating a pull request, merging, tagging, or releasing.

## Current Open Decisions

- Phase 2 refresh interval and retry behavior.
- Whether historical snapshots create enough narrative or strategic value to justify storage, and the smallest useful retention policy if they do.
- The exact verified public Veydrift surfaces needed for a complete player and universe snapshot.
- The representative Phase 3 analysis question suite and bounded OpenAI evaluation budget.
- Whether local/private operation remains sufficient after the MVP; public hosting and authentication are not assumed.

## Build Agreement

> Build the current-state truth layer first, measure whether history is useful, validate model analysis against real data before designing around it, and only then ship the narrative dashboard and nonpersistent strategy chat. Keep the product read-only, the context explicit, and the implementation small.
