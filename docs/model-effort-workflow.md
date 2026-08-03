# Model Effort Workflow

Use this workflow to recommend the lowest adequate coding-agent effort for each repository task. Available effort levels and controls may vary by model and client.

## Capability Boundary

The agent may assess and recommend effort, but must not claim it changed the active setting unless the environment exposes an explicit control and the change succeeds. If the active setting is not visible, say it is unknown.

## Effort Guide

### Low

Use for precise, reversible, mechanical work:

- small copy or formatting edits,
- narrow documentation corrections,
- known-value configuration updates,
- established verification commands, and
- simple file moves or renames.

### Medium

Use for normal scoped implementation with agreed requirements:

- a well-defined component or route,
- deterministic tests for understood behavior,
- contained refactoring within existing patterns, and
- debugging with a small reproducible search space.

Medium is the default for ordinary phase implementation after architecture and scope are approved.

### High

Use when substantial judgment, synthesis, or investigation is required:

- product or phase debriefs,
- architecture or data-model design,
- wallet, signing, authorization, or security decisions,
- migrations or difficult-to-reverse changes,
- external integrations, and
- complex debugging across several system boundaries.

### XHigh

Reserve for unusually ambiguous or consequential work with high rework cost, such as several interacting foundational uncertainties or security-critical design across multiple trust boundaries. Break large but straightforward work into smaller units instead of raising effort solely because of size.

## Reassessment

Reassess when scope changes materially, mechanical work exposes an architectural decision, debugging crosses systems, or secrets, destructive operations, external calls, or production data enter scope.

When a switch matters:

1. Pause at a safe boundary.
2. State the current setting if known.
3. Name the recommended setting and one reason.
4. Wait for the user to change or explicitly retain it.

Higher effort is not a substitute for clarifying the goal, reducing scope, or creating a testable plan.
