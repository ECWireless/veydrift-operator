# Release Tagging Workflow

Veydrift Operator releases use [Semantic Versioning](https://semver.org/) with a `v`-prefixed Git tag such as `v0.1.0`.

## Policy

- Create no tags before the completed v0.1.0 release-readiness gate.
- Release tags point only to reviewed commits on `main`.
- The repository package version matches the tag without the `v` prefix.
- Release tags are annotated and immutable after publication.
- Tags are intentional release actions, not automatic results of merges.
- Push the exact tag rather than `git push --tags`.
- Staging, committing, pushing `main`, creating a tag, pushing a tag, and creating a GitHub Release each require explicit approval unless the user explicitly combines named actions.

Ordinary branches do not increment the version independently. A reviewed release-preparation unit should choose the version, update release notes and compatibility information, pass verification and review, and confirm maintained documentation matches shipped behavior.

While the project remains on `0.x`:

- increment patch for backward-compatible fixes and documentation,
- increment minor for new capabilities or breaking changes, and
- use prerelease identifiers such as `v0.2.0-rc.1` when useful.

## Prepare v0.1.0

The final release-readiness unit must:

1. Complete every phase and gate in `IMPLEMENTATION_PLAN.md`.
2. Confirm durable behavior in maintained documentation.
3. Run the full automated suite and approved review/QA gates.
4. Confirm no secret, private content, or developer-machine data is tracked.
5. Set or confirm the package version `0.1.0`.
6. Delete `IMPLEMENTATION_PLAN.md` in the reviewed release-readiness diff.
7. Merge the approved release-readiness change to `main`.

The plan's deletion does not create or authorize the tag.

## Verify Tag Preconditions

Before creating a tag, verify the repository is on `main`, the version matches, local `HEAD` equals `origin/main`, and the tag is absent locally and remotely. Confirm the exact reviewed commit and release evidence with the user.

## Create And Publish

After explicit approval, create an annotated tag:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
```

Verify the tag object and target, then—after publication approval—push the exact tag:

```bash
git push origin refs/tags/v0.1.0
```

Create a GitHub Release only when separately approved. Release notes should mention material migrations, compatibility limits, and known issues without exposing operational secrets.

## Correcting Mistakes

An incorrect unpushed tag may be deleted and recreated after approval. Never silently move or force-push a published release tag; correct released code with a new reviewed commit and the next patch version.
