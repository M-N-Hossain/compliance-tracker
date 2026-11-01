# How we build features

> **Not ready yet:** the slash commands below are built in Phase 4 of the
> workflow setup. Until then, this file describes the plan. Remove this note
> when Phase 4 is done.

This file describes the process. It enforces nothing: permission rules, hooks,
CI and GitHub settings do that. The commands to run are in the "Commands"
section of CLAUDE.md, so they are not repeated here.

## Which path to use

- **Feature path:** the normal route for anything new.
- **Quick-fix path:** small changes only. If a quick fix turns out to touch the
  schema, auth, or more than a few files, stop and use `/start`.

## Feature path

```text
/start -> /breakdown -> /build -> /test -> /ui-test -> review -> /pr -> /record
```

1. **`/start <idea>`:** asks clarifying questions, then writes
   `docs/specs/NNN-slug.md` with status draft. Stops so the developer can review
   the draft.
2. **`/breakdown NNN`:** adds "## Steps" to the approved spec. Steps are small
   and ordered, each is one commit, each leaves the app working, and each lists
   its files and tests. Stops when the steps are written.
3. **`/build NNN`:** works on branch `feat/NNN-slug`. For each step: failing
   test first where it makes sense, implement, run checks, explain, suggest a
   commit message. Stops after every step.
4. **`/test NNN`:** runs every automated check in CLAUDE.md, then goes through
   the acceptance criteria one by one with evidence.
5. **`/ui-test NNN`:** for any UI change, walks the flows in the browser on
   localhost, including error and empty states. Findings go back to `/build`.
6. **Review:** saves the branch diff to a file. The review-code subagent checks
   it against the spec and CLAUDE.md. The built-in `/code-review` and
   `/security-review` also run. All findings are advice: CI and the developer
   are the gate.
7. **`/pr` (only the developer starts it):** writes the PR description from the
   spec, pushes the branch and opens the PR (both ask first), waits for CI, and
   updates the spec status. The developer reviews and merges.
8. **`/record NNN` (only the developer starts it):** after the merge, writes the
   feature record into the brain repo. It waits for the merge because review
   can still change things. The developer approves the draft and commits it in
   the brain.

The spec file is the memory between sessions.

## Quick-fix path

```text
/quick-fix -> branch fix/slug -> fix -> test -> /pr
```

There is no spec and no feature record.

## Definition of done

A feature is done only when all of these are true:

1. Every acceptance criterion has evidence: a test name or command output.
2. Every automated check in CLAUDE.md passes.
3. Any UI change has been tested in the browser.
4. Review findings have been fixed or knowingly declined.
5. CI is green on the PR.
6. The developer has merged the PR.
7. The feature record has been written.

A quick fix needs items 2 to 6, plus evidence that the fix works.

Never say "done" without evidence.

## Git rules

- **Branches:** `feat/NNN-slug` for features, `fix/slug` for fixes, `chore/slug`
  for maintenance.
- **Commits:** conventional commits, such as `feat: add expiry reminders`. One
  commit per step.
- **Merging:** every change reaches `main` through a PR. Only the developer
  merges.

## Sessions

One feature per session. To continue a feature later, start a new session and
read its spec.
