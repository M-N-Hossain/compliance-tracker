---
name: next
description: Say which stage comes next for a feature spec, from its status, steps, evidence and PR. Read-only. Use when the developer asks what to do next, or runs /next.
argument-hint: <spec-number, or nothing to use the current branch>
# scope: generic means this skill can move to the global setup later.
metadata:
  scope: generic
---

# Say what comes next

The spec number: $ARGUMENTS

This skill only reads. It never edits a file, commits, pushes, or starts the next
stage. It answers in a few lines.

## Steps

1. Find the spec number. If none was given, take it from the current branch name,
   such as `feat/002-login-server-error`. If the branch has no number, ask for
   one and wait. If no spec has this number, the answer is `/start <idea>`.
2. Read the spec at `docs/specs/NNN-*.md`: its status, its type, which steps have
   a "Done: yes" line, and its "Evidence and review" section. Read the evidence
   file, `docs/evidence/NNN-slug.md`, if it exists. Read the workflow file for the
   stage order.
3. Look at the branch and the working tree with read-only git commands. If a PR
   was opened, ask `gh pr list --head <branch> --state all` for its state, and
   `gh pr checks` for CI. If `gh` is not available, say so and ask the developer.
4. Choose the next stage from the status:

   | Status             | Next                                                                                                                                                                    |
   | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | no spec            | `/start <idea>`                                                                                                                                                         |
   | draft              | the developer reviews the draft and resolves any CHECK items, then `/breakdown NNN`. A design goes to the prototype instead.                                            |
   | approved, building | `/build NNN`, naming the first step without "Done: yes". If every step is done, `/test NNN`.                                                                            |
   | tested             | `/ui-test NNN` if a criterion waits for the browser or the slice changes a screen, or skip it and write the reason in the limits line. Otherwise `/review-changes NNN`. |
   | reviewed           | `/pr NNN`. Only the developer starts it.                                                                                                                                |
   | submitted          | PR open: the developer reviews and merges, and CI's state is said. PR merged: `/record NNN`. Only the developer starts it.                                              |

5. Check that the files agree, and say each problem in one line:
   - uncommitted changes, which the next stage will refuse to run with
   - a status that has no matching evidence, such as `tested` with no evidence
     file, or a step marked done without a commit
   - a branch that does not match the spec
   - a design spec: it only has draft and approved, and its next stage is the
     first slice that builds it
6. Answer in at most four lines: the status, the next stage as a command, the
   reason, and any problem from step 5. Never start the stage.

## Limits

- Never change a file, commit, push or merge.
- Never open secret files.
