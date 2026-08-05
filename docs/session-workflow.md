# Session Workflow

Veydrift Operator work may continue across sessions, branches, commits, and pull requests. Every implementation session rebuilds context before editing.

## Sources Of Truth

- `AGENTS.md` defines durable product, security, and contributor agreements.
- `IMPLEMENTATION_PLAN.md` defines the current scope, phase sequence, and temporary delivery decisions.
- This workflow defines planning, verification, review, and publication for each PR-sized unit.
- The live Veydrift deployment is authoritative for game behavior and state interpretation; pinned upstream source is research context.
- Older attachments, handoffs, and chat history are context unless a decision is promoted into tracked documentation.

When tracked sources disagree, stop and resolve the conflict before implementation.

## Start Every Implementation Session

Before editing:

1. Read `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, this workflow, and `docs/model-effort-workflow.md`.
2. Recommend the lowest adequate effort when the setting is relevant and controllable by the user.
3. Confirm the current branch and worktree state.
4. Read every applicable nested `AGENTS.md`.
5. Identify the active phase and agree on one PR-sized unit.
6. Debrief the intended outcome, non-goals, approach, open decisions, dependencies, security/cost effects, verification, review, commit boundary, and PR boundary.
7. Break the unit into sequential tasks and propose the intended commit sequence.
8. Wait for explicit approval before implementation.

Explain and obtain agreement before choosing a new framework, dependency, external service, datastore, signing pattern, or foundational architecture.

## Implementation Rules

- Stay within the agreed unit and active phase.
- Do not begin the next unit without a new debrief and approval.
- Do not install dependencies until their purpose is agreed.
- Preserve ignored local configuration and keep tracked examples synthetic.
- Use fixtures for normal chain/API tests. Live Veydrift or OpenAI calls require explicit scope and approval; game mutation remains outside the current product scope.
- Keep `main` as the approved baseline and use focused conventional branches such as `feat/...`, `fix/...`, `docs/...`, `chore/...`, `refactor/...`, or `test/...`.
- Use conventional commit messages.

## Verification Layers

Choose checks in proportion to risk:

1. **Static:** formatting, lint, strict TypeScript, and production build when configured.
2. **Unit:** snapshot schemas, formulas, derived facts, context assembly, adapters, and state transitions.
3. **Integration:** interval refresh, failure recovery, read APIs, provider isolation, and any explicitly approved persistence.
4. **Source contract:** deterministic API/RPC fixtures and read-only Base behavior checks.
5. **Analysis:** semantic evaluation of narratives and strategy answers against verified context and representative snapshots.
6. **Browser:** primary dashboard workflows at agreed desktop and mobile widths.
7. **Live:** only when separately approved, with bounded Veydrift or OpenAI calls, explicit success criteria, and an OpenAI cost cap where applicable.
8. **Deployment:** only with an explicit target and mutation approval.

Record exact commands, relevant assumptions, passed checks, failures, and intentional omissions.

## Review And Closeout

Before declaring a commit unit complete:

1. Run the agreed verification.
2. Review the complete diff for correctness, regression risk, maintainability, unnecessary complexity, and phase compliance.
3. Confirm secrets remain ignored, external calls are intentional, game data is treated as untrusted model input, and the read-only and provider-data boundaries remain enforced.
4. Run a fresh-context review: one reviewer for a normal unit, or two distinct reviewers for material authentication, privacy, migration, persistence, or data-integrity changes.
5. Evaluate findings rather than accepting them automatically; fix accepted findings and rerun affected checks.
6. Report evidence, deviations, and remaining work.
7. Obtain explicit approval for staging, committing, pushing, PR mutation, merging, tagging, and releasing unless the user explicitly combines named actions.

Read `docs/pr-review-workflow.md` before working with PR feedback.

## Review Severity

- **P0:** catastrophic or unsafe; blocks acceptance immediately.
- **P1:** material correctness, security, data-loss, or approval-boundary risk; blocks merge.
- **P2:** important scope, maintainability, testing, accessibility, or operational issue; normally fix before merge.
- **P3:** minor improvement that may be fixed or explicitly deferred.

If an independent reviewer is unavailable, perform a distinct fresh-context review pass and disclose that it was not independently delegated.

## Plan Retirement

Delete `IMPLEMENTATION_PLAN.md` only in an approved release-readiness unit after every planned phase and acceptance gate is complete, durable behavior is represented in maintained documentation, deferred work is resolved or recorded, and final verification and review pass. Plan deletion does not authorize a tag.
