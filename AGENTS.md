# Veydrift Operator Contributor Guide

## Mission

Build an open-source operator that helps any Veydrift player make better decisions and safely automate bounded actions. The player strategy first pursues and maintains the highest contract-ranked Veydrift Score (`totalUserScore`), then maximizes net financial return under an approved risk budget without weakening the primary objective or its safety envelope.

## Product Principles

- Treat verified live Veydrift contracts as canonical; reconcile runtime configuration and indexed chain data against them and fail closed on disagreement.
- Keep game rules, strategy, notifications, and transaction execution separate.
- Ship Telegram first, but expose notification adapters rather than Telegram-specific strategy code.
- Start with read-only monitoring and approve-only action proposals, then move to explicitly approved strategy envelopes for routine autonomous actions.
- Require explicit limits, audit logs, and a kill switch before unattended execution.
- Keep local setup simple and preserve a clear path to hosted deployment.
- Never commit private keys, bot tokens, RPC credentials, or chat identifiers.
- Keep the project useful for wallets and strategies other than the maintainer's.

## Security Boundaries

- `.env` and all real secrets stay local and Git-ignored.
- Do not print secrets in logs, tests, screenshots, or command output.
- Treat proposed, approved, submitted, confirmed, failed, and cancelled actions as distinct states.
- Bind every autonomous action to an approved, versioned strategy and its explicit limits.
- Simulate and validate every transaction immediately before submission.
- Default new automation capabilities to disabled.

## Working Style

- Prefer small, testable vertical slices.
- Mirror current onchain formulas instead of relying on stale prose documentation.
- Record the upstream Veydrift commit used when changing rule logic or contract interfaces.
- Validate live runtime configuration and deployment identity before constructing game transactions.
- Update `IMPLEMENTATION_PLAN.md` when scope or architectural decisions materially change.
- Follow `docs/session-workflow.md` for PR-sized implementation units and `docs/pr-review-workflow.md` when handling review feedback.
- Avoid speculative infrastructure until a current phase requires it.

## Current Decisions

- Runtime: Bun and TypeScript.
- Dashboard: React with Vite unless an implementation spike finds a concrete blocker.
- Local persistence: SQLite.
- Initial notification adapter: Telegram Bot API.
- Execution progression: observe-only, approve-only, then bounded strategy autonomy.
- Deployment sequence: local first, containerized hosting later.
- Player wallet: configured through environment secrets; never hard-coded.
- Live target: Base mainnet (`chainId` 8453), discovered and validated through Veydrift runtime configuration.
- Primary objective metric: canonical contract `totalUserScore`; economy, research, and military resource-value scores are secondary diagnostics.
- Secondary objective target: after achieving and while maintaining the top canonical rank, maximize net financial return as defined by an approved, versioned financial-objective specification and risk budget. Do not activate it until that deterministic specification and its primary-objective preservation test are approved.
- Transaction source of truth: the live deployment identity and ABI hash. Upstream `main` is used to monitor upcoming changes, not assumed to be deployed.
- Economic design context: the versioned Veydrift whitepaper informs strategy and observability, but never overrides live contracts, runtime configuration, or indexed chain data.
- Resource denominations: preserve a strict boundary between internal game-resource units and external resource-token quantities; verify conversions against the supported deployment.
- Market framing: verified external observations and approved, versioned model assumptions may inform the secondary objective. Keep forecasts and attributable realized outcomes separately labeled; estimates are never a score proxy, peg, profit promise, or guaranteed-yield claim.
- Optional capabilities: an absent or incompatible Rift, resource-token, or market surface disables that capability without blocking safe score-only operation; any capability in use must fail closed on incompatibility.
- Game start: do not fund the operator wallet or claim its first planet until Phase 0 passes its exit gate.

## Verification Baseline

- Unit-test game formulas, strategy decisions, adapter contracts, and action policy.
- Use fixtures for chain/API data so tests do not require live infrastructure.
- Test dry-run and approval flows before permitting transaction submission.
- Verify that removing or disabling a notifier cannot affect strategy or execution.
