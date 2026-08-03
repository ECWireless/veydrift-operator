# Pull Request Review Workflow

Use this workflow when inspecting or addressing GitHub pull-request feedback.

## Safety And Authority

- Never expose credentials, private keys, private data, production records, provider payloads, or local infrastructure details in chat, logs, commits, tests, screenshots, or GitHub replies.
- Prefer repository-scoped credentials with the minimum required permissions.
- Keep authentication in approved local tooling, environment variables, or ignored files.
- Do not stage, commit, push, post comments, dismiss reviews, resolve threads, merge, tag, or release without the corresponding explicit approval.

## Flow

1. Fetch all unresolved review threads, preserving thread IDs, file paths, line anchors, resolution state, and outdated state.
2. Summarize actionable, duplicate, outdated, informational, and ambiguous feedback before editing.
3. Validate every finding against `AGENTS.md`, the active phase in `IMPLEMENTATION_PLAN.md`, relevant code, and tests. Do not assume the reviewer is correct.
4. Pause when feedback broadens the approved phase or weakens a security, transaction, approval, or data-integrity boundary.
5. Fix accepted findings locally and keep each change traceable to its review thread.
6. Run focused checks for narrow changes and broader checks for shared behavior, schemas, signing, authorization, or data integrity.
7. Report fixed and intentionally unchanged threads, changed files, and verification evidence before publication.
8. Reply only after approval and, when code changed, after the fix is pushed. Include the commit SHA when useful.
9. Leave thread resolution to the user unless explicitly delegated.

## Reply Style

Good replies are brief and evidenced:

- `Addressed in abc1234 by revalidating the deployment identity before signing. Verified with the focused policy test.`
- `Leaving this unchanged because the approved phase excludes transaction submission.`
- `Partially addressed: the UI now blocks the action, while the executor remains the authoritative guard.`

Avoid vague replies such as `Fixed`, unnecessary narration, sensitive values, or resolving threads without permission.
