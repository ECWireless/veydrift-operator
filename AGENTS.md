# Veydrift Analyst Contributor Guide

## Mission

Build a small, open-source companion that periodically captures the current public Veydrift game state, explains the universe and the configured player's place in it, and answers nonpersistent strategy questions through an OpenAI-backed chat interface.

The product is read-only. It helps the player understand and decide; it does not sign, submit, approve, or automate game actions.

## Product Principles

- Establish a deterministic, inspectable snapshot before generating any narrative or strategy response.
- Treat verified live Veydrift contracts and reconciled indexed chain data as canonical. Treat the whitepaper as labeled design and economic context.
- Preserve source, observation time, chain position, units, and freshness so generated analysis can distinguish facts from assumptions.
- Give the model a curated, versioned game-context package rather than relying on model memory or sending an undifferentiated document dump.
- Keep the dashboard focused on the latest universe state, the configured player, and useful explanations.
- Keep one local process and one player address for the MVP. Avoid speculative services, abstractions, and infrastructure.
- Measure whether historical snapshots materially improve the product before choosing persistence or retention.
- Keep the OpenAI model configurable while defaulting to the current approved latest model.

## Analysis Boundaries

- Label observed facts, deterministic calculations, model inferences, whitepaper context, and unavailable information distinctly.
- Never invent missing state, mechanics, prices, liquidity, or outcomes.
- Treat player names, planet names, alliance text, and every other string from game data as untrusted data, never as model instructions.
- Include snapshot freshness and material missing inputs in narrative and strategy responses.
- Preserve the player's advisory objective profile: pursue the highest canonical `totalUserScore` first, then consider financial yield. Do not imply guaranteed yield or produce financial conclusions without verified market inputs.
- Strategy answers are advisory. The application has no action, signing, transaction, or approval tools.

## Security And Privacy

- `.env` and all real secrets stay local and Git-ignored.
- Keep `OPENAI_API_KEY` server-side. Never expose it through browser code, API responses, logs, tests, screenshots, or tracked examples.
- The MVP identifies the player through a public wallet address and does not require a private key.
- Send only the game context, current snapshot data, and browser-provided chat turns needed for analysis to OpenAI.
- Use the OpenAI Responses API with `store: false` for MVP requests. The application keeps conversation history only in browser memory and clears it on refresh, but chat turns are still transmitted to OpenAI and remain subject to OpenAI's API data-retention policy; `store: false` does not promise Zero Data Retention.
- Do not add transaction construction, wallet signing, game mutation endpoints, or unattended actions without an explicit future scope change.
- A remotely exposed dashboard requires a separately approved authentication boundary. Local/private operation does not imply public-safe access.

## Working Style

- Prefer small, testable vertical slices.
- Mirror current onchain formulas instead of relying on stale prose documentation.
- Record the upstream Veydrift commit used when changing rule logic or contract interfaces.
- Validate public runtime chain, game address, response shape, and freshness in proportion to the read-only risk; do not pin volatile backend builds merely to block observation.
- Update `IMPLEMENTATION_PLAN.md` when scope or architectural decisions materially change.
- Follow `docs/session-workflow.md` for PR-sized implementation units and `docs/pr-review-workflow.md` when handling review feedback.
- Avoid new dependencies, persistence, background infrastructure, or model tools until the active phase demonstrates a concrete need.

## Current Decisions

- Runtime: Bun and TypeScript.
- Dashboard: React with Vite unless an implementation spike finds a concrete blocker.
- Process shape: one local server hosts the snapshot worker, read API, OpenAI analysis boundary, and dashboard.
- Live target: Base mainnet (`chainId` 8453), discovered through Veydrift runtime configuration.
- Player identity: one configured public wallet address; no private key in the MVP.
- Snapshot baseline: refresh immediately at startup and on a configurable interval; keep the latest normalized snapshot in memory first.
- Historical retention: undecided until Phase 2 measures real snapshot size, storage projections, and demonstrated analytical value.
- Model API: OpenAI Responses API with `store: false`; the API key remains server-side.
- Model selection: a configured model with the current approved latest model as the default. Narrative and strategy may use different reasoning effort without introducing separate provider architecture.
- Chat persistence: browser memory only for the MVP application; no server conversation store. OpenAI provider handling is a separate disclosed data-retention boundary.
- Context authority: verified live rules and reconciled state, then runtime/indexed metadata, then the whitepaper and maintained research notes.
- Advisory objective profile: highest canonical score first, financial yield second when verified inputs support discussing it.
- Deployment: local/private first. Hosting and login are optional later decisions.

The repository currently contains earlier private-key identity and strict deployment-manifest scaffolding. They are historical foundation work, not current MVP requirements, and Phase 2 may remove or simplify them when the snapshot runtime replaces the scaffold.

## Verification Baseline

- Fixture-test snapshot schemas, normalization, derived facts, freshness, interval behavior, and failure state.
- Keep normal tests offline. Live Veydrift and OpenAI calls require an explicitly approved, bounded smoke or evaluation scope.
- Verify every generated analysis receives the intended rules, provenance, snapshot digest, objective profile, and chat turns without secrets.
- Maintain representative analysis questions with factual and qualitative acceptance criteria rather than exact model prose.
- Test that stale, malformed, or incomplete source data is surfaced and never silently converted into confident analysis.
- Verify dashboard loading, snapshot freshness/error presentation, narrative rendering, and chat behavior at agreed desktop and mobile sizes.
